import { useState, useRef, useEffect } from "react";

/**
 * Main page component for the chord sheet generator.
 *
 * This React component provides a UI to load metadata from a YouTube
 * URL, upload an audio file, configure analysis settings (transpose and
 * mode), optionally include lyrics and LRC for alignment, and display
 * the resulting chord sheet synchronized with audio playback.
 */
export default function Home() {
  const [ytUrl, setYtUrl] = useState("");
  const [meta, setMeta] = useState(null);

  const [audio, setAudio] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transpose, setTranspose] = useState(0);
  const [mode, setMode] = useState("simple"); // 'simple' | 'full'

  const [lyricsText, setLyricsText] = useState("");
  const [lrcText, setLrcText] = useState("");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Audio playback state
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Create object URL for audio playback when file is selected
  useEffect(() => {
    if (audio) {
      const url = URL.createObjectURL(audio);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audio]);

  // Update current time during playback
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleTimeUpdate = () => setCurrentTime(audioEl.currentTime);
    const handleLoadedMetadata = () => setDuration(audioEl.duration);
    const handleEnded = () => setIsPlaying(false);

    audioEl.addEventListener("timeupdate", handleTimeUpdate);
    audioEl.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioEl.addEventListener("ended", handleEnded);

    return () => {
      audioEl.removeEventListener("timeupdate", handleTimeUpdate);
      audioEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioEl.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  /**
   * Fetch basic metadata (title, author, thumbnail) from a YouTube URL
   * using the public oEmbed endpoint.
   */
  async function fetchYoutubeMeta() {
    if (!ytUrl) return;
    const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      ytUrl
    )}&format=json`;
    try {
      const r = await fetch(oembed);
      if (!r.ok) throw new Error("Failed to fetch YouTube metadata");
      const j = await r.json();
      setMeta(j);
    } catch (err) {
      console.error(err);
      setMeta(null);
    }
  }

  /**
   * Send the uploaded audio and settings to the backend for analysis.
   */
  async function analyze() {
    if (!audio) return;
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("audio", audio);
    fd.append("transpose", String(transpose));
    fd.append("mode", mode);
    fd.append("title", meta?.title || "");
    fd.append("artist", meta?.author_name || "");
    fd.append("lyrics_text", lyricsText);
    fd.append("lrc_text", lrcText);

    try {
      const r = await fetch("http://localhost:4433/api/analyze", {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      setResult(j);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  // Find current chord based on playback time
  function getCurrentChord() {
    if (!result?.chords) return null;
    for (const c of result.chords) {
      if (c.start <= currentTime && currentTime < c.end) {
        return c;
      }
    }
    return null;
  }

  // Format time as mm:ss
  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const currentChord = getCurrentChord();

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "24px auto",
        fontFamily: "system-ui",
        padding: "0 16px",
      }}
    >
      <h1>Chord Sheet Generator</h1>

      {/* Input section: YouTube metadata and audio upload */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}
        >
          <h3>YouTube URL (metadata only)</h3>
          <input
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{ width: "100%", padding: 10, boxSizing: "border-box" }}
          />
          <button onClick={fetchYoutubeMeta} style={{ marginTop: 10 }}>
            Load video info
          </button>

          {meta && (
            <div style={{ marginTop: 12 }}>
              <div>
                <b>{meta.title}</b>
              </div>
              <div style={{ color: "#666" }}>{meta.author_name}</div>
              <img
                src={meta.thumbnail_url}
                alt="Video thumbnail"
                style={{
                  width: "100%",
                  marginTop: 10,
                  borderRadius: 10,
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}
        >
          <h3>Audio file (upload)</h3>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudio(e.target.files?.[0] || null)}
          />
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <b>Modulation</b>
            <button onClick={() => setTranspose((t) => t - 1)}>-½</button>
            <div style={{ width: 40, textAlign: "center" }}>{transpose}</div>
            <button onClick={() => setTranspose((t) => t + 1)}>+½</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <b>Mode</b>
            <label style={{ marginLeft: 10 }}>
              <input
                type="radio"
                checked={mode === "simple"}
                onChange={() => setMode("simple")}
              />
              Simple
            </label>
            <label style={{ marginLeft: 10 }}>
              <input
                type="radio"
                checked={mode === "full"}
                onChange={() => setMode("full")}
              />
              Full
            </label>
          </div>

          <button
            onClick={analyze}
            disabled={!audio || loading}
            style={{ marginTop: 12 }}
          >
            {loading ? "Processing..." : "Generate chord sheet"}
          </button>
        </div>
      </div>

      {/* Lyrics input */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <h3>Lyrics (optional)</h3>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <textarea
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            placeholder="Paste lyrics text here (optional)"
            style={{ width: "100%", minHeight: 160, padding: 10 }}
          />
          <textarea
            value={lrcText}
            onChange={(e) => setLrcText(e.target.value)}
            placeholder="Paste LRC here for best alignment (optional)\n[00:12.00] line..."
            style={{ width: "100%", minHeight: 160, padding: 10 }}
          />
        </div>
        <div style={{ color: "#666", marginTop: 8 }}>
          Tip: אם יש לך LRC, האקורדים ייושרו הרבה יותר טוב לליריקס.
        </div>
      </div>

      {/* Audio Player */}
      {audioUrl && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#f9f9f9",
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
          </div>

          {/* Current chord display */}
          {result && (
            <div
              style={{
                marginTop: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                Current Chord
              </div>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  color: currentChord?.label === "N" ? "#ccc" : "#333",
                  minHeight: 80,
                }}
              >
                {currentChord?.label || "-"}
              </div>
            </div>
          )}
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
          <h3>Chord Timeline</h3>

          {/* Visual chord timeline */}
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
            {result.chords.map((chord, i) => {
              const totalDuration = duration || result.chords[result.chords.length - 1]?.end || 1;
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
                    transition: "background 0.1s",
                  }}
                  title={`${chord.label} (${formatTime(chord.start)} - ${formatTime(chord.end)})`}
                >
                  {width > 3 && (
                    <span
                      style={{
                        fontSize: width > 6 ? 12 : 10,
                        fontWeight: 600,
                        color: "#fff",
                        textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        padding: "0 2px",
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

          {/* Chord sheet with lyrics */}
          <h3>Chord Sheet</h3>
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
                      transition: "background 0.2s",
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
                        transition: "all 0.1s",
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
  );
}
