# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ZorKi - Get Me Chords**: A full-stack app that detects chords from YouTube videos and displays them in a synchronized chord sheet with lyrics. Uses Chordino (VAMP plugin) for chord detection, librosa for beat/tempo analysis, and LRCLIB for lyrics.

## Development Commands

### Server (FastAPI + Docker)
```bash
cd server
docker build -t guitar-chords-server .
docker run -p 4433:8080 guitar-chords-server
```
The server runs at `http://localhost:4433`. The Dockerfile builds the Chordino VAMP plugin from source, so the server **must** run in Docker.

### Client (Next.js)
```bash
cd client
npm install
npm run dev -- -p 3001
```
The client runs at `http://localhost:3001`. No test suite or linter is configured.

## Architecture

**Two-service architecture**: Next.js frontend (`client/`) communicates with a FastAPI backend (`server/`) via REST.

### Backend Processing Pipeline
1. Extract video ID from YouTube URL → download audio via `yt-dlp` → convert to mono WAV (44.1kHz) via ffmpeg
2. Run Chordino VAMP plugin for chord detection (`chordino.py`)
3. Detect beats/tempo/time signature via librosa (`beat_detection.py`)
4. Optionally fetch lyrics from LRCLIB (`lyrics_fetch.py`) and align chords to LRC timestamps (`lyrics_align.py`)
5. Cache results locally (`downloads/{video_id}/metadata.json` + MP3) and in GCS (`gcs_storage.py`)

### Key Design Decisions
- **Raw chord caching**: `metadata.json` stores `chords_raw` (untransposed), so transpose/mode can be reapplied per-request without re-analyzing audio
- **Chord postprocessing** in `chordino.py`: merges consecutive identical chords, filters segments < 150ms, applies transpose via chromatic scale mapping, and "simple" mode strips extensions (maj7→major, etc.)
- **YouTube handling** in `youtube_utils.py`: cleans URLs (strips playlist params), uses player client rotation in production (cookies in dev only)

### Frontend (`client/pages/index.jsx`)
Single-page app with: audio player synced via `requestAnimationFrame`, chord timeline with bar/beat markers, chord sheet grid (10-second rows), LRC lyrics alignment, interactive chord diagrams (65+ shapes in `ChordDiagram.jsx`), transpose/mode/auto-scroll controls. Uses CSS Modules for styling.

## Environment Variables
- `ENV`: set to `"dev"` to use cookies for yt-dlp; production uses player client rotation
- `CORS_ORIGINS`: comma-separated allowed origins (default: `localhost:3000,3001`)
- `GCS_BUCKET`: GCS bucket name for persistent storage
- `NEXT_PUBLIC_API_URL`: API base URL baked into the client at build time

## API Endpoints
- `POST /api/analyze-youtube` — main endpoint: YouTube URL → chord analysis (cached)
- `POST /api/analyze` — direct audio file upload analysis
- `GET /api/fetch-lyrics?track=...&artist=...` — LRCLIB lyrics search
- `GET /api/audio/{video_id}` — serve cached MP3 (local then GCS fallback)
- `GET /api/health` — health check
