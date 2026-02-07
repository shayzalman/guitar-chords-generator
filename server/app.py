from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import tempfile
import os
import uuid
import subprocess
from chordino import run_chordino, postprocess_chords
from lyrics_align import align_chords_to_lrc, build_chord_sheet_lines
from beat_detection import detect_beats
from youtube_utils import download_youtube_audio


app = FastAPI()

# Create downloads directory if not exists
DOWNLOADS_DIR = "downloads"
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Mount downloads directory for static serving
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
    return {"status": "ok", "version": "1.1"}


@app.post("/api/analyze-youtube")
async def analyze_youtube(
    youtube_url: str = Form(...),
    transpose: int = Form(0),
    mode: str = Form("simple"),  # simple | full
    lyrics_text: str = Form(""),
    lrc_text: str = Form(""),
):
    """Download audio from YouTube, analyze it and return results."""
    # Use a unique ID for this download to avoid collisions
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(DOWNLOADS_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    # Download audio from YouTube
    try:
        mp3_path = download_youtube_audio(youtube_url, job_dir)
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

        filename = os.path.basename(mp3_path)
        # Use relative path for internal URL or just the filename if we know the structure
        # audio_url = f"http://localhost:4433/downloads/{job_id}/{filename}"
        # In a real app we'd use a proper base URL or relative path
        audio_url = f"/downloads/{job_id}/{filename}"

        return {
            "meta": {
                "title": filename.replace(".mp3", ""),
                "transpose": transpose,
                "mode": mode,
                "youtube_url": youtube_url,
                "audio_url": audio_url
            },
            "chords": chords,
            "aligned_lrc": aligned,
            "sheet_lines": sheet_lines,
            "beat_info": beat_info,
        }
