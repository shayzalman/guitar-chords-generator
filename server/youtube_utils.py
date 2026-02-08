import yt_dlp
import os
import re
from urllib.parse import urlparse, parse_qs


def extract_video_id(url: str) -> str:
    """Extract the YouTube video ID from various URL formats."""
    # Handle youtu.be short URLs
    if "youtu.be" in url:
        path = urlparse(url).path
        return path.lstrip("/").split("?")[0]

    # Handle youtube.com URLs
    parsed = urlparse(url)
    if "youtube.com" in parsed.netloc:
        # Standard watch URL: youtube.com/watch?v=VIDEO_ID
        if parsed.path == "/watch":
            qs = parse_qs(parsed.query)
            if "v" in qs:
                return qs["v"][0]
        # Embed URL: youtube.com/embed/VIDEO_ID
        elif "/embed/" in parsed.path:
            return parsed.path.split("/embed/")[1].split("?")[0]
        # Shorts URL: youtube.com/shorts/VIDEO_ID
        elif "/shorts/" in parsed.path:
            return parsed.path.split("/shorts/")[1].split("?")[0]

    # Fallback: try regex for video ID pattern
    match = re.search(r"(?:v=|/)([a-zA-Z0-9_-]{11})(?:\?|&|$|/)", url)
    if match:
        return match.group(1)

    raise ValueError(f"Could not extract video ID from URL: {url}")


def download_youtube_audio(url: str, output_dir: str) -> dict:
    """
    Downloads audio from a YouTube URL and returns a dictionary with metadata and the path to the downloaded file.
    """
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        # yt-dlp might change the extension to mp3 because of the postprocessor
        filename = ydl.prepare_filename(info)
        # The filename prepared by ydl might have the original extension (e.g. .webm)
        # but after postprocessing it will be .mp3
        base, _ = os.path.splitext(filename)
        mp3_path = base + ".mp3"
        
        # Ensure the file actually exists (yt-dlp can be tricky with filenames)
        if not os.path.exists(mp3_path):
             # Try to find any mp3 file in the output_dir that was just created
             files = [f for f in os.listdir(output_dir) if f.endswith(".mp3")]
             if files:
                 mp3_path = os.path.join(output_dir, files[0])
        
        return {
            "path": mp3_path,
            "video_id": info.get("id", extract_video_id(url)),
            "title": info.get("title", "Unknown Title"),
            "artist": info.get("uploader", "Unknown Artist"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
        }
