"""
Lyrics fetching from LRCLIB API.

LRCLIB is a free, open lyrics database that provides both synced (LRC) and
plain lyrics. No API key required.

API Documentation: https://lrclib.net/docs
"""

import requests
from typing import Optional, Dict, Any

LRCLIB_BASE_URL = "https://lrclib.net/api"
USER_AGENT = "ZorKi-ChordSheet/1.0 (https://github.com/example/zorki)"


def search_lyrics(track_name: str, artist_name: str = "") -> Optional[Dict[str, Any]]:
    """
    Search for lyrics on LRCLIB by track name and artist.

    Args:
        track_name: The song title
        artist_name: The artist name (optional but recommended)

    Returns:
        Dictionary with lyrics data or None if not found.
        Contains: id, trackName, artistName, albumName, duration,
                  plainLyrics, syncedLyrics
    """
    headers = {"User-Agent": USER_AGENT}

    # Try exact match first using /get endpoint
    params = {"track_name": track_name}
    if artist_name:
        params["artist_name"] = artist_name

    try:
        response = requests.get(
            f"{LRCLIB_BASE_URL}/get",
            params=params,
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data and (data.get("plainLyrics") or data.get("syncedLyrics")):
                return data
    except requests.RequestException:
        pass

    # Fall back to search endpoint
    try:
        search_params = {"q": f"{artist_name} {track_name}".strip()}
        response = requests.get(
            f"{LRCLIB_BASE_URL}/search",
            params=search_params,
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            results = response.json()
            if results and len(results) > 0:
                # Return the first result that has lyrics
                for result in results:
                    if result.get("plainLyrics") or result.get("syncedLyrics"):
                        return result
    except requests.RequestException:
        pass

    return None


def convert_synced_to_lrc(synced_lyrics: str) -> str:
    """
    LRCLIB already returns lyrics in LRC format, so just return as-is.
    The format is already: [mm:ss.xx] lyrics line
    """
    return synced_lyrics if synced_lyrics else ""


def fetch_lyrics(track_name: str, artist_name: str = "") -> Dict[str, Any]:
    """
    Fetch lyrics for a track, returning both plain and LRC formats.

    Args:
        track_name: The song title
        artist_name: The artist name (optional)

    Returns:
        Dictionary with:
        - found: bool
        - track_name: str
        - artist_name: str
        - plain_lyrics: str (plain text lyrics)
        - lrc_lyrics: str (synced lyrics in LRC format)
        - source: str (always "lrclib")
    """
    result = search_lyrics(track_name, artist_name)

    if result:
        return {
            "found": True,
            "track_name": result.get("trackName", track_name),
            "artist_name": result.get("artistName", artist_name),
            "album_name": result.get("albumName", ""),
            "plain_lyrics": result.get("plainLyrics", ""),
            "lrc_lyrics": result.get("syncedLyrics", ""),
            "source": "lrclib"
        }

    return {
        "found": False,
        "track_name": track_name,
        "artist_name": artist_name,
        "album_name": "",
        "plain_lyrics": "",
        "lrc_lyrics": "",
        "source": "lrclib"
    }
