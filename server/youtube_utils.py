import yt_dlp
import os
import tempfile

def download_youtube_audio(url: str, output_dir: str) -> str:
    """
    Downloads audio from a YouTube URL and returns the path to the downloaded file (converted to mp3).
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
        
        return mp3_path
