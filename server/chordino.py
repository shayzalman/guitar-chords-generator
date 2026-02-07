"""
Utility functions for running the Chordino vamp plugin and post‑processing
its output. Chordino is a popular plugin for estimating chord labels from
audio using chroma features and NNLS chroma templates. These helpers
invoke the tool via sonic‑annotator, parse its CSV output, and provide
simple operations for transposition and simplification.

The functions defined here are intended to be imported by the FastAPI
endpoint in ``app.py``. They do not depend on FastAPI and can be reused
independently.
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from typing import List, Dict, Optional, Any


def run_chordino(wav_path: str) -> List[Dict[str, Any]]:
    """Run the Chordino vamp plugin via sonic‑annotator on the given WAV file.

    Returns a list of dictionaries with start time, end time, chord label
    and confidence (confidence may be None depending on plugin version).

    Requires ``sonic‑annotator`` and the ``nnls‑chroma:chordino`` vamp
    plugin to be installed. In a Docker environment this is typically
    provided by the ``vamp‑plugin‑packages`` package.
    """
    # Output CSV file path in a temporary directory
    out_csv = os.path.join(tempfile.gettempdir(), "chords_out.csv")
    # Invoke sonic‑annotator to run the plugin and output CSV
    subprocess.check_call([
        "sonic-annotator",
        "-d", "vamp:nnls-chroma:chordino:chords",
        "-w", "csv",
        "--csv-one-file", out_csv,
        wav_path,
    ])

    chords: List[Dict[str, Any]] = []
    # Parse the CSV file; each row contains timestamp, duration and chord label
    with open(out_csv, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            parts = [p.strip().strip('"') for p in line.split(",")]
            # Expect at least timestamp, duration and label
            if len(parts) < 3:
                continue
            try:
                start = float(parts[0])
                dur = float(parts[1])
                label = parts[2]
            except Exception:
                continue
            chords.append({"start": start, "end": start + dur, "label": label, "confidence": None})

    # Merge consecutive identical chords
    merged: List[Dict[str, Any]] = []
    for c in chords:
        if not merged or merged[-1]["label"] != c["label"]:
            merged.append(c)
        else:
            merged[-1]["end"] = c["end"]
    return merged


def transpose_label(label: str, semitones: int) -> str:
    """Transpose a chord label by a number of semitones.

    This function applies a simple transposition by altering the root of
    the chord. It does not attempt to handle complex enharmonic cases or
    compound labels. Unrecognised labels are returned unchanged.
    """
    if label in ("N", "X", ""):
        return label
    # Parse root note and accidental
    m = re.match(r"^([A-G])([#b]?)(.*)$", label)
    if not m:
        return label
    base, acc, rest = m.group(1), m.group(2), m.group(3)

    pc_map = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    pc = pc_map[base] + (1 if acc == "#" else -1 if acc == "b" else 0)
    pc = (pc + semitones) % 12
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    return f"{names[pc]}{rest}"


def simplify_label(label: str) -> str:
    """Simplify a chord label by removing seventh and extension indicators."""
    # Remove specific patterns signifying extensions; extend as needed
    simple = label.replace(":maj7", "").replace(":7", "").replace(":min7", ":min")
    simple = simple.replace("maj7", "").replace("m7", "m").replace("7", "")
    return simple


def postprocess_chords(chords: List[Dict[str, Any]], transpose: int = 0, mode: str = "simple") -> List[Dict[str, Any]]:
    """Apply transposition and simplification to a chord sequence.

    Args:
        chords: List of chord dictionaries with 'label', 'start' and 'end'.
        transpose: Number of semitones to shift up (positive) or down (negative).
        mode: 'simple' to reduce to triads, 'full' to keep original labels.

    Returns:
        A new list of chord dictionaries with processed labels and merged
        consecutive segments of the same chord.
    """
    processed = []
    for c in chords:
        lbl = c["label"]
        if transpose:
            lbl = transpose_label(lbl, transpose)
        if mode == "simple":
            lbl = simplify_label(lbl)
        processed.append({**c, "label": lbl})

    # Filter out extremely short segments and merge identical neighbours
    filtered: List[Dict[str, Any]] = []
    for c in processed:
        segment_len = c["end"] - c["start"]
        if segment_len < 0.15:
            if filtered:
                filtered[-1]["end"] = c["end"]
            continue
        if filtered and filtered[-1]["label"] == c["label"]:
            filtered[-1]["end"] = c["end"]
        else:
            filtered.append(c)
    return filtered