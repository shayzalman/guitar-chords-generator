"""
Utility functions for running the Chordino vamp plugin and post‑processing
its output. Chordino is a popular plugin for estimating chord labels from
audio using chroma features and NNLS chroma templates. These helpers
use the Python vamp library to run the plugin, and provide simple operations
for transposition and simplification.

The functions defined here are intended to be imported by the FastAPI
endpoint in ``app.py``. They do not depend on FastAPI and can be reused
independently.
"""

from __future__ import annotations

import os
import re
import wave
from typing import List, Dict, Any

import numpy as np
import vamp


def run_chordino(wav_path: str) -> List[Dict[str, Any]]:
    """Run the Chordino vamp plugin on the given WAV file using Python vamp library.

    Returns a list of dictionaries with start time, end time, chord label
    and confidence (confidence may be None depending on plugin version).

    Requires the ``nnls‑chroma`` vamp plugin to be installed in the system
    VAMP_PATH (typically /usr/local/lib/vamp).
    """
    # Set VAMP_PATH to ensure the plugin is found
    os.environ['VAMP_PATH'] = '/usr/local/lib/vamp'
    
    # Read WAV file
    with wave.open(wav_path, 'rb') as wf:
        sample_rate = wf.getframerate()
        n_channels = wf.getnchannels()
        n_frames = wf.getnframes()
        raw_data = wf.readframes(n_frames)
    
    # Convert to numpy array (mono, float)
    audio = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32) / 32768.0
    if n_channels > 1:
        audio = audio.reshape(-1, n_channels).mean(axis=1)
    
    # Run the chordino plugin (output="simplechord" returns chord labels)
    results = vamp.collect(audio, sample_rate, "nnls-chroma:chordino", output="simplechord")
    
    chords: List[Dict[str, Any]] = []
    chord_list = results.get("list", [])
    
    for i, item in enumerate(chord_list):
        start = float(item["timestamp"])
        # Duration may be provided, or we calculate from next chord
        if "duration" in item and item["duration"]:
            dur = float(item["duration"])
        elif i + 1 < len(chord_list):
            dur = float(chord_list[i + 1]["timestamp"]) - start
        else:
            dur = 1.0  # Default duration for last chord
        label = item.get("label", "N")
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
