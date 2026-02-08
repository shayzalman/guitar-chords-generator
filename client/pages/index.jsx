import { useState, useRef, useEffect } from "react";
import Head from "next/head";

/**
 * Main page component for the chord sheet generator.
 *
 * This React component provides a UI to analyze YouTube videos for chord
 * detection, configure analysis settings (transpose and mode), optionally
 * include lyrics and LRC for alignment, and display the resulting chord
 * sheet synchronized with audio playback. Analyzed songs are cached on
 * the server along with their lyrics for quick reloading.
 */
export default function Home() {
  const [ytUrl, setYtUrl] = useState("");
  const [meta, setMeta] = useState(null);

  const [audioUrl, setAudioUrl] = useState(null);
  const [transpose, setTranspose] = useState(0);
  const [mode, setMode] = useState("simple"); // 'simple' | 'full'

  const [lyricsText, setLyricsText] = useState("");
  const [lrcText, setLrcText] = useState("");
  const [fetchingLyrics, setFetchingLyrics] = useState(false);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Audio playback state
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Auto-scroll to active row
  useEffect(() => {
    // Only scroll if auto-scroll is enabled, we are playing and have results
    if (!autoScroll || !isPlaying || !result) return;

    // Find current row index (rows are 10 seconds each)
    const rowDuration = 10;
    const currentRowIdx = Math.floor(currentTime / rowDuration);
    
    // We scroll only when the row index changes
    const rowEl = document.getElementById(`chord-row-${currentRowIdx}`);
    if (rowEl) {
      rowEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [Math.floor(currentTime / 10), isPlaying, !!result]);

  // Update current time during playback using requestAnimationFrame for smooth sync
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    let animationFrameId = null;

    const updateTime = () => {
      if (audioEl && !audioEl.paused) {
        setCurrentTime(audioEl.currentTime);
        animationFrameId = requestAnimationFrame(updateTime);
      }
    };

    const handlePlay = () => {
      animationFrameId = requestAnimationFrame(updateTime);
    };

    const handlePause = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      setCurrentTime(audioEl.currentTime);
    };

    const handleSeeked = () => {
      setCurrentTime(audioEl.currentTime);
    };

    const handleLoadedMetadata = () => setDuration(audioEl.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    audioEl.addEventListener("play", handlePlay);
    audioEl.addEventListener("pause", handlePause);
    audioEl.addEventListener("seeked", handleSeeked);
    audioEl.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioEl.addEventListener("ended", handleEnded);

    // If already playing when effect runs, start the animation loop
    if (!audioEl.paused) {
      animationFrameId = requestAnimationFrame(updateTime);
    }

    return () => {
      audioEl.removeEventListener("play", handlePlay);
      audioEl.removeEventListener("pause", handlePause);
      audioEl.removeEventListener("seeked", handleSeeked);
      audioEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioEl.removeEventListener("ended", handleEnded);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [audioUrl]);

  /**
   * Extract audio from YouTube and analyze.
   */
  async function analyzeYoutube() {
    if (!ytUrl) return;
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("youtube_url", ytUrl);
    fd.append("transpose", String(transpose));
    fd.append("mode", mode);
    fd.append("lyrics_text", lyricsText);
    fd.append("lrc_text", lrcText);

    try {
      const r = await fetch("http://localhost:4433/api/analyze-youtube", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      if (j.error) {
        alert(j.error);
        return;
      }
      setResult(j);
      
      // Update local metadata if the backend returned it
      if (j.meta) {
        setMeta({
          title: j.meta.title,
          author_name: j.meta.artist,
          thumbnail_url: j.meta.thumbnail,
        });
      }

      if (j.meta?.audio_url) {
        // Handle both relative and absolute URLs
        const finalAudioUrl = j.meta.audio_url.startsWith("http")
          ? j.meta.audio_url
          : `http://localhost:4433${j.meta.audio_url}`;
        setAudioUrl(finalAudioUrl);
      }

      // Load cached lyrics if available and not already set
      if (j.lyrics_text && !lyricsText) {
        setLyricsText(j.lyrics_text);
      }
      if (j.lrc_text && !lrcText) {
        setLrcText(j.lrc_text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetch lyrics from LRCLIB based on song title and artist.
   */
  async function fetchLyrics() {
    if (!meta?.title) return;

    setFetchingLyrics(true);
    try {
      const params = new URLSearchParams({
        track: meta.title,
        artist: meta.author_name || "",
      });

      const r = await fetch(`http://localhost:4433/api/fetch-lyrics?${params}`);
      const j = await r.json();

      if (j.found) {
        if (j.plain_lyrics && !lyricsText) {
          setLyricsText(j.plain_lyrics);
        }
        if (j.lrc_lyrics && !lrcText) {
          setLrcText(j.lrc_lyrics);
        }
        if (!j.plain_lyrics && !j.lrc_lyrics) {
          alert("Lyrics found but empty. Try a different search.");
        }
      } else {
        alert("No lyrics found for this song.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to fetch lyrics. Is the server running?");
    } finally {
      setFetchingLyrics(false);
    }
  }

  // Playback controls
  function togglePlay() {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.pause();
    } else {
      audioEl.play();
    }
    setIsPlaying(!isPlaying);
  }

  function seek(e) {
    const audioEl = audioRef.current;
    if (!audioEl || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioEl.currentTime = pct * duration;
  }

  // Find current chord and upcoming chords based on playback time
  function getCurrentAndUpcomingChords() {
    if (!result?.chords) return { current: null, upcoming: [] };

    let currentIdx = -1;
    for (let i = 0; i < result.chords.length; i++) {
      const c = result.chords[i];
      if (c.start <= currentTime && currentTime < c.end) {
        currentIdx = i;
        break;
      }
    }

    if (currentIdx === -1) {
      // No current chord, find the next one
      for (let i = 0; i < result.chords.length; i++) {
        if (result.chords[i].start > currentTime) {
          return { current: null, upcoming: result.chords.slice(i, i + 4).filter(c => c.label !== "N") };
        }
      }
      return { current: null, upcoming: [] };
    }

    const current = result.chords[currentIdx];
    // Get next 3 chords that are not "N" (no chord)
    const upcoming = [];
    for (let i = currentIdx + 1; i < result.chords.length && upcoming.length < 3; i++) {
      if (result.chords[i].label !== "N") {
        upcoming.push(result.chords[i]);
      }
    }

    return { current, upcoming };
  }

  // Format time as mm:ss
  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const { current: currentChord, upcoming: upcomingChords } = getCurrentAndUpcomingChords();

  return (
    <>
      <Head>
        <title>ZorKi - Get Me Chords</title>
        <meta name="description" content="Automatically detect chords from YouTube videos" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div
        style={{
          maxWidth: 980,
          margin: "24px auto",
          fontFamily: "system-ui",
          padding: "0 16px",
          textAlign: "center",
        }}
      >
        <h1>ZorKi - Get me Chords</h1>

      {/* Input section: YouTube URL and settings */}
      <div
        style={{
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <h3>YouTube URL</h3>
        <input
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          style={{ width: "100%", padding: 10, boxSizing: "border-box", marginBottom: 12 }}
        />

        {/* Settings row */}
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b>Transpose</b>
            <button
              onClick={() => setTranspose((t) => t - 1)}
              style={{ padding: "4px 10px", cursor: "pointer" }}
            >
              -½
            </button>
            <div style={{ width: 40, textAlign: "center", fontWeight: 600 }}>{transpose}</div>
            <button
              onClick={() => setTranspose((t) => t + 1)}
              style={{ padding: "4px 10px", cursor: "pointer" }}
            >
              +½
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b>Mode</b>
            <label style={{ marginLeft: 4 }}>
              <input
                type="radio"
                checked={mode === "simple"}
                onChange={() => setMode("simple")}
              />
              Simple
            </label>
            <label style={{ marginLeft: 8 }}>
              <input
                type="radio"
                checked={mode === "full"}
                onChange={() => setMode("full")}
              />
              Full
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <b>Auto-scroll</b>
            </label>
          </div>

          <button
            onClick={analyzeYoutube}
            disabled={!ytUrl || loading}
            style={{
              background: "#f44336",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 4,
              cursor: ytUrl && !loading ? "pointer" : "not-allowed",
              fontWeight: 600,
            }}
          >
            {loading ? "Processing..." : "Analyze"}
          </button>
        </div>

        {meta && (
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginTop: 12,
              padding: 12,
              background: "#f9f9f9",
              borderRadius: 8,
            }}
          >
            {meta.thumbnail_url && (
              <img
                src={meta.thumbnail_url}
                alt="Video thumbnail"
                style={{
                  width: 120,
                  borderRadius: 8,
                }}
              />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{meta.title}</div>
              <div style={{ color: "#666" }}>{meta.author_name}</div>
              {result?.meta?.cached && (
                <div style={{ color: "#4CAF50", fontSize: 12, marginTop: 4 }}>
                  Loaded from cache
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lyrics input */}
      <div
        style={{
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Lyrics (optional)</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={fetchLyrics}
              disabled={!meta?.title || fetchingLyrics}
              style={{
                background: meta?.title && !fetchingLyrics ? "#1976D2" : "#ccc",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                cursor: meta?.title && !fetchingLyrics ? "pointer" : "not-allowed",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {fetchingLyrics ? "Fetching..." : "Fetch Lyrics"}
            </button>
            <span style={{ fontSize: 12, color: "#666" }}>
              Lyrics are saved with the song
            </span>
          </div>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label style={{ fontSize: 12, color: "#666", marginBottom: 4, display: "block" }}>
              Plain lyrics
            </label>
            <textarea
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Paste lyrics text here (optional)"
              style={{ width: "100%", minHeight: 140, padding: 10, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", marginBottom: 4, display: "block" }}>
              LRC format (timed lyrics)
            </label>
            <textarea
              value={lrcText}
              onChange={(e) => setLrcText(e.target.value)}
              placeholder="[00:12.00] First line&#10;[00:15.50] Second line..."
              style={{ width: "100%", minHeight: 140, padding: 10, boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div style={{ color: "#666", fontSize: 13 }}>
            Tip: LRC provides better chord-to-lyric alignment
          </div>
          <a
            href="https://www.lyricsify.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: "#1976D2", textDecoration: "none" }}
          >
            Find LRC on Lyricsify
          </a>
        </div>
      </div>

      {/* Audio Player - Sticky */}
      {audioUrl && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 99,
            padding: 16,
            border: "1px solid #e0c84a",
            borderRadius: 12,
            background: "#fff8a1",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <audio ref={audioRef} src={audioUrl} preload="metadata" />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={togglePlay}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "none",
                background: "#333",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <div style={{ flex: 1 }}>
              <div
                onClick={seek}
                style={{
                  height: 8,
                  background: "#ddd",
                  borderRadius: 4,
                  cursor: "pointer",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: duration ? `${(currentTime / duration) * 100}%` : 0,
                    background: "#333",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#666",
                  marginTop: 4,
                }}
              >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            {/* Current chord and upcoming chords display */}
            {result && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexShrink: 0,
                  paddingLeft: 16,
                  borderLeft: "2px solid rgba(0,0,0,0.1)",
                  marginLeft: 8,
                }}
              >
                {/* Current chord */}
                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Now
                  </div>
                  <div
                    style={{
                      fontSize: 42,
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      color: currentChord?.label === "N" ? "#ccc" : "#222",
                      lineHeight: 1,
                    }}
                  >
                    {currentChord?.label || "-"}
                  </div>
                </div>

                {/* Upcoming chords */}
                {upcomingChords.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: 0.7,
                    }}
                  >
                    <div style={{ fontSize: 18, color: "#999", marginRight: 4 }}>›</div>
                    {upcomingChords.map((chord, i) => (
                      <div
                        key={i}
                        style={{
                          textAlign: "center",
                          padding: "4px 8px",
                          background: "rgba(255,255,255,0.6)",
                          borderRadius: 6,
                          minWidth: 36,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 18 - i * 2,
                            fontWeight: 600,
                            fontFamily: "ui-monospace, monospace",
                            color: "#555",
                            lineHeight: 1.2,
                          }}
                        >
                          {chord.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results display - Chord Timeline */}
      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          {/* Beat Info Display */}
          {result.beat_info && (
            <div
              style={{
                display: "flex",
                gap: 24,
                marginBottom: 16,
                padding: 12,
                background: "#f0f7ff",
                borderRadius: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#666" }}>Tempo:</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#1976D2" }}>
                  {result.beat_info.tempo} BPM
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#666" }}>Time Signature:</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#1976D2" }}>
                  {result.beat_info.time_signature?.numerator || 4}/{result.beat_info.time_signature?.denominator || 4}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#666" }}>Bars:</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: "#333" }}>
                  {result.beat_info.downbeats?.length || 0}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#666" }}>Beats:</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: "#333" }}>
                  {result.beat_info.beats?.length || 0}
                </span>
              </div>
            </div>
          )}

          <h3>Chord Timeline</h3>

          {/* Visual chord timeline with bar lines */}
          <div
            style={{
              position: "relative",
              height: 60,
              background: "#f5f5f5",
              borderRadius: 8,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            {/* Bar lines (downbeats) */}
            {result.beat_info?.downbeats?.map((downbeat, i) => {
              const totalDuration = duration || result.chords?.[result.chords?.length - 1]?.end || 1;
              const left = (downbeat / totalDuration) * 100;
              return (
                <div
                  key={`bar-${i}`}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "rgba(0, 0, 0, 0.6)",
                    zIndex: 5,
                    pointerEvents: "none",
                  }}
                  title={`Bar ${i + 1} (${formatTime(downbeat)})`}
                />
              );
            })}

            {/* Beat markers (smaller ticks) */}
            {result.beat_info?.beats?.map((beat, i) => {
              const totalDuration = duration || result.chords?.[result.chords?.length - 1]?.end || 1;
              const left = (beat / totalDuration) * 100;
              const isDownbeat = result.beat_info?.downbeats?.some(
                (db) => Math.abs(db - beat) < 0.05
              );
              if (isDownbeat) return null; // Skip downbeats, they have their own markers
              return (
                <div
                  key={`beat-${i}`}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    top: 0,
                    height: "30%",
                    width: 1,
                    background: "rgba(0, 0, 0, 0.3)",
                    zIndex: 4,
                    pointerEvents: "none",
                  }}
                />
              );
            })}

            {result.chords?.map((chord, i) => {
              const totalDuration = duration || result.chords?.[result.chords?.length - 1]?.end || 1;
              const left = (chord.start / totalDuration) * 100;
              const width = ((chord.end - chord.start) / totalDuration) * 100;
              const isActive = currentChord === chord;
              const isN = chord.label === "N";

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = chord.start;
                    }
                  }}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    width: `${Math.max(width, 0.5)}%`,
                    height: "100%",
                    background: isN
                      ? "#e0e0e0"
                      : isActive
                      ? "#4CAF50"
                      : "#2196F3",
                    borderRight: "1px solid #fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 1,
                  }}
                  title={`${chord.label} (${formatTime(chord.start)} - ${formatTime(chord.end)})`}
                >
                  {width > 3 && (
                    <span
                      style={{
                        fontSize: width > 6 ? 12 : 10,
                        fontWeight: 600,
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.4)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        padding: "2px 4px",
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: 3,
                        position: "relative",
                        zIndex: 10,
                      }}
                    >
                      {chord.label}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Playhead */}
            {duration > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: `${(currentTime / duration) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "#f44336",
                  zIndex: 10,
                }}
              />
            )}
          </div>

          {/* Chord Sheet - Timeline Grid Display */}
          <h3>Chord Sheet</h3>
          
          {/* Timeline Grid - Chords aligned to timestamps */}
          {(() => {
            if (!result?.chords || result.chords.length === 0) return null;
            const totalDur = duration || result.chords[result.chords.length - 1]?.end || 1;
            // Get beat info for bar lines
            const downbeats = result.beat_info?.downbeats || [];
            const beats = result.beat_info?.beats || [];
            // Create time markers every 2 seconds
            const timeMarkers = [];
            for (let t = 0; t <= totalDur; t += 2) {
              timeMarkers.push(t);
            }
            // Group chords into rows (e.g., 10 seconds per row)
            const rowDuration = 10;
            const numRows = Math.ceil(totalDur / rowDuration);
            const rows = [];
            for (let r = 0; r < numRows; r++) {
              const rowStart = r * rowDuration;
              const rowEnd = Math.min((r + 1) * rowDuration, totalDur);
              const rowChords = result.chords.filter(
                (c) => c.start < rowEnd && c.end > rowStart
              );
              // Get downbeats (bar lines) for this row
              const rowDownbeats = downbeats.filter(
                (db) => db >= rowStart && db < rowEnd
              );
              // Get beats for this row
              const rowBeats = beats.filter(
                (b) => b >= rowStart && b < rowEnd
              );
              // Get lyrics for this row if LRC is available
              const rowLyrics = result.aligned_lrc
                ? result.aligned_lrc.filter(
                    (l, i) => {
                      const nextT = i < result.aligned_lrc.length - 1 
                        ? result.aligned_lrc[i + 1].t 
                        : totalDur;
                      return l.t < rowEnd && nextT > rowStart;
                    }
                  )
                : [];
              rows.push({ rowStart, rowEnd, chords: rowChords, lyrics: rowLyrics, downbeats: rowDownbeats, beats: rowBeats });
            }

            return (
              <div style={{ marginBottom: 24 }}>
                {rows.map((row, rowIdx) => {
                  const rowWidth = row.rowEnd - row.rowStart;
                  const isCurrentRow = currentTime >= row.rowStart && currentTime < row.rowEnd;
                  
                  return (
                    <div
                      key={rowIdx}
                      id={`chord-row-${rowIdx}`}
                      style={{
                        marginBottom: 24,
                        padding: 12,
                        background: isCurrentRow ? "#f0f7ff" : "#fafafa",
                        borderRadius: 8,
                        border: isCurrentRow ? "2px solid #2196F3" : "1px solid #e0e0e0",
                      }}
                    >
                      {/* Time markers row */}
                      <div
                        style={{
                          position: "relative",
                          height: 20,
                          marginBottom: 4,
                          borderBottom: "1px solid #ddd",
                        }}
                      >
                        {timeMarkers
                          .filter((t) => t >= row.rowStart && t <= row.rowEnd)
                          .map((t) => {
                            const left = ((t - row.rowStart) / rowWidth) * 100;
                            return (
                              <div
                                key={t}
                                style={{
                                  position: "absolute",
                                  left: `${left}%`,
                                  fontSize: 10,
                                  color: "#999",
                                  transform: "translateX(-50%)",
                                  zIndex: 20,
                                }}
                              >
                                {formatTime(t)}
                              </div>
                            );
                          })}
                      </div>

                      {/* Chord blocks row */}
                      <div
                        style={{
                          position: "relative",
                          height: 48,
                          background: "#fff",
                          borderRadius: 4,
                          overflow: "hidden",
                          marginBottom: 8,
                        }}
                      >
                        {/* Bar lines (downbeats) */}
                        {row.downbeats.map((db, i) => {
                          const left = ((db - row.rowStart) / rowWidth) * 100;
                          // Find bar number
                          const barNum = downbeats.indexOf(db) + 1;
                          return (
                            <div
                              key={`bar-${i}`}
                              style={{
                                position: "absolute",
                                left: `${left}%`,
                                top: 0,
                                bottom: 0,
                                width: 2,
                                background: "#333",
                                zIndex: 6,
                                pointerEvents: "none",
                              }}
                              title={`Bar ${barNum}`}
                            >
                              {/* Bar number label */}
                              <span
                                style={{
                                  position: "absolute",
                                  top: -16,
                                  left: 2,
                                  fontSize: 9,
                                  color: "#666",
                                  fontWeight: 600,
                                }}
                              >
                                {barNum}
                              </span>
                            </div>
                          );
                        })}

                        {/* Beat markers (smaller ticks) */}
                        {row.beats.map((beat, i) => {
                          const left = ((beat - row.rowStart) / rowWidth) * 100;
                          const isDownbeat = row.downbeats.some(
                            (db) => Math.abs(db - beat) < 0.05
                          );
                          if (isDownbeat) return null;
                          return (
                            <div
                              key={`beat-${i}`}
                              style={{
                                position: "absolute",
                                left: `${left}%`,
                                top: 0,
                                height: "25%",
                                width: 1,
                                background: "rgba(0, 0, 0, 0.25)",
                                zIndex: 5,
                                pointerEvents: "none",
                              }}
                            />
                          );
                        })}

                        {row.chords.map((chord, i) => {
                          // Clamp chord to row boundaries
                          const chordStart = Math.max(chord.start, row.rowStart);
                          const chordEnd = Math.min(chord.end, row.rowEnd);
                          const left = ((chordStart - row.rowStart) / rowWidth) * 100;
                          const width = ((chordEnd - chordStart) / rowWidth) * 100;
                          const isActive = currentTime >= chord.start && currentTime < chord.end;
                          const isN = chord.label === "N";

                          return (
                            <div
                              key={i}
                              onClick={() => {
                                if (audioRef.current) {
                                  audioRef.current.currentTime = chord.start;
                                }
                              }}
                              style={{
                                position: "absolute",
                                left: `${left}%`,
                                width: `${Math.max(width, 1)}%`,
                                height: "100%",
                                background: isN
                                  ? "#f5f5f5"
                                  : isActive
                                  ? "#4CAF50"
                                  : "#2196F3",
                                borderRight: "1px solid #fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                              title={`${chord.label} (${formatTime(chord.start)} - ${formatTime(chord.end)})`}
                            >
                              <span
                                style={{
                                  fontSize: width > 10 ? 12 : width > 4 ? 10 : 7,
                                  fontWeight: 700,
                                  color: isN ? "#999" : "#fff",
                                  textShadow: isN ? "none" : "0 1px 2px rgba(0,0,0,0.4)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  padding: "2px 6px",
                                  background: isN ? "transparent" : "rgba(0,0,0,0.25)",
                                  borderRadius: 3,
                                  position: "relative",
                                  zIndex: 10,
                                }}
                              >
                                {chord.label}
                              </span>
                            </div>
                          );
                        })}

                        {/* Playhead for current row */}
                        {isCurrentRow && (
                          <div
                            style={{
                              position: "absolute",
                              left: `${((currentTime - row.rowStart) / rowWidth) * 100}%`,
                              top: 0,
                              bottom: 0,
                              width: 3,
                              background: "#f44336",
                              zIndex: 15,
                              boxShadow: "0 0 4px rgba(244,67,54,0.5)",
                            }}
                          />
                        )}
                      </div>

                      {/* Lyrics row aligned to timestamps */}
                      {row.lyrics.length > 0 && (
                        <div
                          style={{
                            position: "relative",
                            minHeight: 24,
                            marginTop: 4,
                          }}
                        >
                          {row.lyrics.map((lyric, i) => {
                            const lyricStart = Math.max(lyric.t, row.rowStart);
                            const left = ((lyricStart - row.rowStart) / rowWidth) * 100;
                            const isCurrentLyric =
                              i < row.lyrics.length - 1
                                ? currentTime >= lyric.t && currentTime < row.lyrics[i + 1].t
                                : currentTime >= lyric.t;

                            return (
                              <div
                                key={i}
                                onClick={() => {
                                  if (audioRef.current) {
                                    audioRef.current.currentTime = lyric.t;
                                  }
                                }}
                                style={{
                                  position: "absolute",
                                  left: `${left}%`,
                                  fontSize: 12,
                                  color: isCurrentLyric ? "#1976D2" : "#666",
                                  fontWeight: isCurrentLyric ? 600 : 400,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  maxWidth: "30%",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  background: isCurrentLyric ? "#e3f2fd" : "transparent",
                                  padding: "2px 4px",
                                  borderRadius: 4,
                                }}
                                title={`${lyric.text} (${formatTime(lyric.t)})`}
                              >
                                {lyric.text}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Traditional Chord Sheet View (collapsible) */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 12 }}>
              Traditional Chord Sheet View
            </summary>
            <div
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                lineHeight: 1.6,
              }}
            >
              {result.aligned_lrc ? (
                // LRC-aligned display with timing
                result.aligned_lrc.map((line, i) => {
                  const isCurrentLine =
                    i < result.aligned_lrc.length - 1
                      ? currentTime >= line.t && currentTime < result.aligned_lrc[i + 1].t
                      : currentTime >= line.t;

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = line.t;
                        }
                      }}
                      style={{
                        marginBottom: 16,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: isCurrentLine ? "#e3f2fd" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: isCurrentLine ? "#1976D2" : "#333",
                          fontSize: 18,
                        }}
                      >
                        {line.chord}
                      </div>
                      <div style={{ color: isCurrentLine ? "#333" : "#666" }}>
                        {line.text}
                      </div>
                      <div style={{ fontSize: 10, color: "#999" }}>
                        {formatTime(line.t)}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Fallback: show sheet_lines without timing
                result.sheet_lines.map((l, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 700 }}>{l.chordsLine}</div>
                    <div>{l.lyricsLine}</div>
                  </div>
                ))
              )}
            </div>
          </details>

          {/* Chord progression summary */}
          <div style={{ marginTop: 24 }}>
            <h4>All Chords in Order</h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {result.chords
                .filter((c) => c.label !== "N")
                .map((chord, i) => {
                  const isActive = currentChord === chord;
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = chord.start;
                        }
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: isActive ? "#4CAF50" : "#e0e0e0",
                        color: isActive ? "#fff" : "#333",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                      title={`${formatTime(chord.start)} - ${formatTime(chord.end)}`}
                    >
                      {chord.label}
                    </div>
                  );
                })}
            </div>
          </div>

          <button onClick={() => window.print()} style={{ marginTop: 16 }}>
            Export PDF (Print → Save as PDF)
          </button>
        </div>
      )}
    </div>
    </>
  );
}
