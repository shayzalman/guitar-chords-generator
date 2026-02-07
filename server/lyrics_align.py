"""
Helpers for parsing LRC lyric files and aligning chord segments to lyric
timestamps. This module supports basic extraction of timestamped lyric
lines from LRC strings and associates each line with the predominant
chord occurring within its time range. It also provides a routine to
construct chord sheet lines for display when full lyric alignment is
unavailable.
"""

import re
from typing import List, Dict, Optional, Any


def parse_lrc(lrc_text: str) -> List[Dict[str, Any]]:
    """Parse LRC formatted lyrics into a list of timestamped lines.

    The LRC format encodes lyric lines with timestamps in the form
    ``[mm:ss.xx] line text``. This parser extracts the minutes and
    seconds values and converts them into a floating point time in
    seconds. Lines without valid timestamps are ignored.
    """
    lines: List[Dict[str, Any]] = []
    for raw in lrc_text.splitlines():
        m = re.match(r"^\[(\d+):(\d+(?:\.\d+)?)\](.*)$", raw.strip())
        if not m:
            continue
        mm = int(m.group(1))
        ss = float(m.group(2))
        t = mm * 60 + ss
        text = m.group(3).strip()
        lines.append({"t": t, "text": text})
    # Sort by time to ensure chronological order
    lines.sort(key=lambda x: x["t"])
    return lines


def chord_at_time(chords: List[Dict[str, Any]], t: float) -> str:
    """Return the chord label active at a given time t from a chord list."""
    for c in chords:
        if c["start"] <= t < c["end"]:
            return c["label"]
    return "N"


def align_chords_to_lrc(chords: List[Dict[str, Any]], lrc_text: str) -> List[Dict[str, Any]]:
    """Align chords to LRC lyric lines by choosing the predominant chord in each line.

    For each lyric line, this function samples a few points within the
    interval between the current line's timestamp and the next line's
    timestamp. It then selects the chord label that occurs most
    frequently among those samples. The result is a list of lyric lines
    with an associated chord label.
    """
    lrc = parse_lrc(lrc_text)
    out: List[Dict[str, Any]] = []
    for i, line in enumerate(lrc):
        t0 = line["t"]
        t1 = lrc[i + 1]["t"] if i + 1 < len(lrc) else (t0 + 5.0)
        # Sample a few points within [t0, t1)
        samples = [t0, (t0 + t1) / 2, max(t0, t1 - 0.01)]
        labels = [chord_at_time(chords, t) for t in samples]
        # Choose the most common label among the samples
        if labels:
            best = max(set(labels), key=labels.count)
        else:
            best = "N"
        out.append({"t": t0, "text": line["text"], "chord": best})
    return out


def build_chord_sheet_lines(
    chords: List[Dict[str, Any]],
    lyrics_text: str,
    aligned_lrc: Optional[List[Dict[str, Any]]],
    mode: str = "simple",
) -> List[Dict[str, str]]:
    """Construct chord and lyric lines for display.

    If aligned LRC is provided, each line of the result will contain
    the chord label (as computed by ``align_chords_to_lrc``) and the
    corresponding lyric text. If only plain lyrics are available,
    this function returns a single line with the unique chord
    progression followed by the lyrics block. When no lyrics are
    provided, it returns a summary of the chord sequence.
    """
    if aligned_lrc:
        lines: List[Dict[str, str]] = []
        for item in aligned_lrc:
            chord = item["chord"]
            lyric = item["text"]
            # Place the chord above the lyric line; advanced formatting
            # could be implemented client‑side
            lines.append({"chordsLine": chord, "lyricsLine": lyric})
        return lines

    # If plain lyrics are provided but no LRC alignment, return a single block
    if lyrics_text.strip():
        # Derive a short progression preview from the first few chords
        uniq: List[str] = []
        for c in chords:
            label = c["label"]
            if label not in ("N", "X", ""):
                if not uniq or uniq[-1] != label:
                    uniq.append(label)
            if len(uniq) >= 8:
                break
        progression = " | ".join(uniq) if uniq else ""
        return [{"chordsLine": progression, "lyricsLine": lyrics_text.strip()}]

    # If no lyrics at all, summarise the chord sequence
    return [{"chordsLine": " ".join([c['label'] for c in chords[:32]]), "lyricsLine": ""}]