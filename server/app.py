from fastapi import FastAPI, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import tempfile
import os
import json
import subprocess
from chordino import run_chordino, postprocess_chords
from lyrics_align import align_chords_to_lrc, build_chord_sheet_lines
from beat_detection import detect_beats
from youtube_utils import download_youtube_audio, extract_video_id
from lyrics_fetch import fetch_lyrics


app = FastAPI()

# Create downloads directory if not exists
DOWNLOADS_DIR = "downloads"
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Mount downloads directory for static serving
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze")
async def analyze(
    audio: UploadFile = File(...),
    transpose: int = Form(0),
    mode: str = Form("simple"),  # simple | full
    title: str = Form(""),
    artist: str = Form(""),
    lyrics_text: str = Form(""),
    lrc_text: str = Form(""),
):
    """Analyze an uploaded audio file and return chord and lyric alignment.

    The function accepts an uploaded audio file along with optional metadata
    and lyric strings. It converts the audio to a mono WAV file, runs a
    chord detection algorithm, applies post‑processing (transpose and
    simplification), and optionally aligns chords to lyric timestamps from
    LRC. Finally it constructs a list of chord/lyric lines for rendering
    in the client.
    """
    with tempfile.TemporaryDirectory() as td:
        # Save the uploaded audio to a temp file
        in_path = os.path.join(td, audio.filename)
        with open(in_path, "wb") as f:
            f.write(await audio.read())

        # Convert to mono WAV at 44.1kHz
        wav_path = os.path.join(td, "in.wav")
        subprocess.check_call([
            "ffmpeg", "-y", "-i", in_path,
            "-ac", "1", "-ar", "44100",
            wav_path
        ])

        # Run chord detection and post‑process according to settings
        chords = run_chordino(wav_path)  # list of {start, end, label}
        chords = postprocess_chords(chords, transpose=transpose, mode=mode)

        # Detect beats, tempo, and time signature
        beat_info = detect_beats(wav_path)

        # Align chords to LRC if provided
        aligned = None
        if lrc_text.strip():
            aligned = align_chords_to_lrc(chords, lrc_text)

        # Build chord sheet lines for output
        sheet_lines = build_chord_sheet_lines(
            chords=chords,
            lyrics_text=lyrics_text,
            aligned_lrc=aligned,
            mode=mode,
        )

        return {
            "meta": {
                "title": title,
                "artist": artist,
                "transpose": transpose,
                "mode": mode,
            },
            "chords": chords,
            "aligned_lrc": aligned,
            "sheet_lines": sheet_lines,
            "beat_info": beat_info,
        }


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.3", "features": ["analyze", "analyze-youtube", "beat-detection", "fetch-lyrics"]}


@app.get("/api/fetch-lyrics")
async def api_fetch_lyrics(
    track: str = Query(..., description="Song title"),
    artist: str = Query("", description="Artist name (optional but recommended)"),
):
    """Fetch lyrics from LRCLIB for a given track and artist.

    Returns both plain text lyrics and synced LRC lyrics if available.
    LRCLIB is a free, open lyrics database - no API key required.
    """
    result = fetch_lyrics(track, artist)
    return result


@app.post("/api/analyze-youtube")
async def analyze_youtube(
    youtube_url: str = Form(...),
    transpose: int = Form(0),
    mode: str = Form("simple"),  # simple | full
    lyrics_text: str = Form(""),
    lrc_text: str = Form(""),
    save_lyrics: bool = Form(True),  # Whether to save/update lyrics in cache
):
    """Download audio from YouTube, analyze it and return results.

    Uses caching: if the video was previously processed, loads cached data.
    Cache is stored in downloads/<video_id>/ with metadata.json containing
    all analysis results including lyrics.
    """
    # Extract video ID to use as cache key
    try:
        video_id = extract_video_id(youtube_url)
    except ValueError as e:
        return {"error": str(e)}

    job_dir = os.path.join(DOWNLOADS_DIR, video_id)
    cache_file = os.path.join(job_dir, "metadata.json")

    # Check if we have cached data for this video
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_data = json.load(f)

            # Use provided lyrics or fall back to cached lyrics
            used_lyrics_text = lyrics_text.strip() if lyrics_text.strip() else cached_data.get("lyrics_text", "")
            used_lrc_text = lrc_text.strip() if lrc_text.strip() else cached_data.get("lrc_text", "")

            # Update cached lyrics if new ones provided
            if save_lyrics and (lyrics_text.strip() or lrc_text.strip()):
                if lyrics_text.strip():
                    cached_data["lyrics_text"] = lyrics_text.strip()
                if lrc_text.strip():
                    cached_data["lrc_text"] = lrc_text.strip()
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump(cached_data, f, ensure_ascii=False, indent=2)

            # Re-apply transpose and mode settings (these can change per request)
            chords = cached_data.get("chords_raw", cached_data.get("chords", []))
            chords = postprocess_chords(chords, transpose=transpose, mode=mode)

            # Re-align to LRC if provided
            aligned = None
            if used_lrc_text:
                aligned = align_chords_to_lrc(chords, used_lrc_text)

            # Rebuild sheet lines with current settings
            sheet_lines = build_chord_sheet_lines(
                chords=chords,
                lyrics_text=used_lyrics_text,
                aligned_lrc=aligned,
                mode=mode,
            )

            # Find the MP3 file in the cache directory
            mp3_files = [f for f in os.listdir(job_dir) if f.endswith(".mp3")]
            if mp3_files:
                audio_url = f"/downloads/{video_id}/{mp3_files[0]}"
            else:
                audio_url = cached_data.get("meta", {}).get("audio_url", "")

            return {
                "meta": {
                    "title": cached_data.get("meta", {}).get("title", ""),
                    "artist": cached_data.get("meta", {}).get("artist", ""),
                    "transpose": transpose,
                    "mode": mode,
                    "youtube_url": youtube_url,
                    "audio_url": audio_url,
                    "thumbnail": cached_data.get("meta", {}).get("thumbnail"),
                    "duration": cached_data.get("meta", {}).get("duration"),
                    "cached": True,
                },
                "chords": chords,
                "aligned_lrc": aligned,
                "sheet_lines": sheet_lines,
                "beat_info": cached_data.get("beat_info", {}),
                "lyrics_text": used_lyrics_text,
                "lrc_text": used_lrc_text,
            }
        except (json.JSONDecodeError, KeyError) as e:
            # Cache is corrupted, reprocess
            pass

    # No cache found, download and process
    os.makedirs(job_dir, exist_ok=True)

    # Download audio from YouTube
    try:
        yt_data = download_youtube_audio(youtube_url, job_dir)
        mp3_path = yt_data["path"]
        yt_title = yt_data.get("title", "")
        yt_artist = yt_data.get("artist", "")
    except Exception as e:
        return {"error": f"Failed to download YouTube audio: {str(e)}"}

    # We'll use a temp dir for the wav processing to keep job_dir clean (only mp3 remains)
    with tempfile.TemporaryDirectory() as td:
        # Convert to mono WAV at 44.1kHz
        wav_path = os.path.join(td, "in.wav")
        subprocess.check_call([
            "ffmpeg", "-y", "-i", mp3_path,
            "-ac", "1", "-ar", "44100",
            wav_path
        ])

        # Run chord detection and post‑process according to settings
        chords_raw = run_chordino(wav_path)  # list of {start, end, label}
        chords = postprocess_chords(chords_raw, transpose=transpose, mode=mode)

        # Detect beats, tempo, and time signature
        beat_info = detect_beats(wav_path)

        # Align chords to LRC if provided
        aligned = None
        if lrc_text.strip():
            aligned = align_chords_to_lrc(chords, lrc_text)

        # Build chord sheet lines for output
        sheet_lines = build_chord_sheet_lines(
            chords=chords,
            lyrics_text=lyrics_text,
            aligned_lrc=aligned,
            mode=mode,
        )

        filename = os.path.basename(mp3_path)
        audio_url = f"/downloads/{video_id}/{filename}"

        # Save cache data (raw chords without transpose/mode applied)
        cache_data = {
            "meta": {
                "title": yt_title or filename.replace(".mp3", ""),
                "artist": yt_artist,
                "youtube_url": youtube_url,
                "audio_url": audio_url,
                "thumbnail": yt_data.get("thumbnail"),
                "duration": yt_data.get("duration"),
                "video_id": video_id,
            },
            "chords_raw": chords_raw,  # Raw chords for reprocessing with different settings
            "beat_info": beat_info,
            "lyrics_text": lyrics_text.strip(),
            "lrc_text": lrc_text.strip(),
        }

        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)

        return {
            "meta": {
                "title": yt_title or filename.replace(".mp3", ""),
                "artist": yt_artist,
                "transpose": transpose,
                "mode": mode,
                "youtube_url": youtube_url,
                "audio_url": audio_url,
                "thumbnail": yt_data.get("thumbnail"),
                "duration": yt_data.get("duration"),
                "cached": False,
            },
            "chords": chords,
            "aligned_lrc": aligned,
            "sheet_lines": sheet_lines,
            "beat_info": beat_info,
            "lyrics_text": lyrics_text.strip(),
            "lrc_text": lrc_text.strip(),
        }
