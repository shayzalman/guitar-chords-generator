import yt_dlp
import os
import re
import logging
from urllib.parse import urlparse, parse_qs
logger = logging.getLogger(__name__)


def extract_video_id(url: str) -> str:
    """Extract the YouTube video ID from various URL formats."""
    # Handle youtu.be short URLs
    if "youtu.be" in url:
        path = urlparse(url).path
        return path.lstrip("/").split("?")[0].split("/")[0]

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
            return parsed.path.split("/embed/")[1].split("?")[0].split("/")[0]
        # Shorts URL: youtube.com/shorts/VIDEO_ID
        elif "/shorts/" in parsed.path:
            return parsed.path.split("/shorts/")[1].split("?")[0].split("/")[0]

    # Fallback: try regex for video ID pattern
    match = re.search(r"(?:v=|/)([a-zA-Z0-9_-]{11})(?:\?|&|$|/)", url)
    if match:
        return match.group(1)

    raise ValueError(f"Could not extract video ID from URL: {url}")


def clean_youtube_url(url: str) -> str:
    """
    Clean a YouTube URL by removing extra parameters (list, index, etc.)
    and keeping only the video ID parameter.

    Returns a clean URL in the format: https://www.youtube.com/watch?v=VIDEO_ID
    """
    video_id = extract_video_id(url)
    return f"https://www.youtube.com/watch?v={video_id}"


def download_youtube_audio(url: str, output_dir: str) -> dict:
    """
    Downloads audio from a YouTube URL and returns a dictionary with metadata and the path to the downloaded file.

    The URL is cleaned to remove extra parameters (list, index, etc.) before processing.
    """
    # Clean URL to only include video ID (removes playlist and other params)
    url = clean_youtube_url(url)

    is_prod = os.environ.get("ENV") != "dev"

    ydl_opts = {
        'format': 'bestaudio*/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'quiet': True,
        'no_warnings': True,
    }

    if is_prod:
        ydl_opts['extractor_args'] = {'youtube': {'player_client': ['web_creator', 'mediaconnect']}}

    # Use cookies if available to bypass bot detection
    cookie_file = os.path.join(os.path.dirname(__file__), 'cookies.txt')
    if os.path.exists(cookie_file):
        ydl_opts['cookiefile'] = cookie_file
        logger.info("Using cookies from %s", cookie_file)

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
