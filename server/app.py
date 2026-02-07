from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import subprocess
from chordino import run_chordino, postprocess_chords
from lyrics_align import align_chords_to_lrc, build_chord_sheet_lines


app = FastAPI()

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
        }