import { useState } from "react";

/**
 * Main page component for the chord sheet generator.
 *
 * This React component provides a simple UI to load metadata from a YouTube
 * URL, upload an audio file, configure analysis settings (transpose and
 * mode), optionally include lyrics and LRC for alignment, and display
 * the resulting chord sheet. It communicates with a FastAPI backend via
 * the /api/analyze endpoint and expects a JSON response containing
 * chord information and formatted sheet lines.
 */
export default function Home() {
  const [ytUrl, setYtUrl] = useState("");
  const [meta, setMeta] = useState(null);

  const [audio, setAudio] = useState(null);
  const [transpose, setTranspose] = useState(0);
  const [mode, setMode] = useState("simple"); // 'simple' | 'full'

  const [lyricsText, setLyricsText] = useState("");
  const [lrcText, setLrcText] = useState("");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Fetch basic metadata (title, author, thumbnail) from a YouTube URL
   * using the public oEmbed endpoint. This avoids downloading the video
   * and stays within legal usage by only retrieving metadata for
   * display.
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
   * The backend returns chord data, optional lyric alignment, and
   * preformatted sheet lines for rendering.
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

      {/* Results display */}
      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <h3>Chord Sheet</h3>
          <div
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              whiteSpace: "pre-wrap",
              lineHeight: 1.4,
            }}
          >
            {result.sheet_lines.map((l, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>{l.chordsLine}</div>
                <div>{l.lyricsLine}</div>
              </div>
            ))}
          </div>
          <button onClick={() => window.print()} style={{ marginTop: 12 }}>
            Export PDF (Print → Save as PDF)
          </button>
        </div>
      )}
    </div>
  );
}
