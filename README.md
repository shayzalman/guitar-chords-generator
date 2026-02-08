# ZorKi - Get Me Chords

A web application that automatically detects chords from YouTube videos and displays them in a synchronized chord sheet. Perfect for musicians who want to learn songs by ear or need quick chord charts.

## Features

- **YouTube Integration**: Paste any YouTube URL to analyze the song
- **Automatic Chord Detection**: Uses Chordino/VAMP plugin for accurate chord recognition
- **Beat & Tempo Detection**: Detects BPM and time signature using librosa
- **Synced Playback**: Chords highlight in real-time as the song plays
- **Lyrics Support**:
  - Fetch lyrics automatically from LRCLIB
  - Support for LRC (timed lyrics) format for better chord-lyric alignment
  - Lyrics are saved with each song
- **Transpose**: Shift chords up or down by semitones
- **Simple/Full Mode**: Toggle between simplified chords (e.g., C instead of Cmaj7) and full chord names
- **Auto-scroll**: Automatically scrolls to follow playback (toggleable)
- **Caching**: Processed songs are cached for instant loading on repeat visits

## Project Structure

```
guitar-chords/
├── client/                 # Next.js frontend
│   ├── pages/
│   │   └── index.jsx      # Main application UI
│   └── package.json
├── server/                 # Python FastAPI backend
│   ├── app.py             # Main API endpoints
│   ├── chordino.py        # Chord detection using VAMP
│   ├── beat_detection.py  # Tempo and beat analysis
│   ├── lyrics_fetch.py    # LRCLIB lyrics fetching
│   ├── lyrics_align.py    # Chord-lyric alignment
│   ├── youtube_utils.py   # YouTube URL handling and download
│   ├── requirements.txt   # Python dependencies
│   └── Dockerfile         # Container configuration
└── README.md
```

## Tech Stack

### Frontend
- **Next.js 14** - React framework
- **React** - UI components

### Backend
- **FastAPI** - Python web framework
- **yt-dlp** - YouTube audio extraction
- **VAMP / Chordino** - Audio analysis and chord detection
- **librosa** - Beat and tempo detection
- **LRCLIB API** - Free lyrics database

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (for the server)

### Running the Server

```bash
cd server
docker build -t guitar-chords-server .
docker run -p 4433:8080 guitar-chords-server
```

The server will be available at `http://localhost:4433`

### Running the Client

```bash
cd client
npm install
npm run dev -- -p 3001
```

The client will be available at `http://localhost:3001`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/analyze-youtube` | POST | Analyze a YouTube video for chords |
| `/api/fetch-lyrics` | GET | Fetch lyrics from LRCLIB |

### Analyze YouTube Request

```
POST /api/analyze-youtube
Content-Type: multipart/form-data

youtube_url: string (required)
transpose: int (default: 0)
mode: "simple" | "full" (default: "simple")
lyrics_text: string (optional)
lrc_text: string (optional)
```

### Fetch Lyrics Request

```
GET /api/fetch-lyrics?track=Song+Name&artist=Artist+Name
```

## Caching

Processed songs are cached in the `downloads/` directory:

```
downloads/
└── {video_id}/
    ├── {song_title}.mp3    # Downloaded audio
    └── metadata.json        # Cached analysis data
```

The cache stores:
- Raw chord data (for reprocessing with different transpose/mode)
- Beat and tempo information
- Lyrics (plain text and LRC)
- Song metadata (title, artist, thumbnail, duration)

## Configuration

### CORS Origins

Update allowed origins in `server/app.py`:

```python
allow_origins=["http://localhost:3000", "http://localhost:3001"],
```

## Credits

- [Chordino](http://www.isophonics.net/nnls-chroma) - Chord detection VAMP plugin
- [LRCLIB](https://lrclib.net) - Free lyrics database
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube downloader
- [librosa](https://librosa.org) - Audio analysis library

## License

MIT
