"""
Beat and tempo detection using librosa.

This module provides functions to detect the tempo (BPM), beat positions,
and time signature from audio files. The detected beats can be used to
draw bar lines on the chord timeline display.
"""

from __future__ import annotations

from typing import Dict, Any, List
import numpy as np
import librosa


def detect_beats(wav_path: str) -> Dict[str, Any]:
    """Detect tempo and beat positions from a WAV file.
    
    Args:
        wav_path: Path to the WAV audio file.
        
    Returns:
        Dictionary containing:
        - tempo: Estimated tempo in BPM (float)
        - beats: List of beat timestamps in seconds
        - downbeats: List of downbeat (bar start) timestamps in seconds
        - time_signature: Estimated time signature (default 4/4)
    """
    # Load audio file
    y, sr = librosa.load(wav_path, sr=None, mono=True)
    
    # Detect tempo and beat frames
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    
    # Convert tempo to scalar if it's an array
    if hasattr(tempo, '__len__'):
        tempo = float(tempo[0]) if len(tempo) > 0 else 120.0
    else:
        tempo = float(tempo)
    
    # Convert beat frames to timestamps
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beats = [float(t) for t in beat_times]
    
    # Estimate time signature (default to 4/4)
    # We use a simple heuristic: analyze beat strength patterns
    time_signature = estimate_time_signature(y, sr, beat_frames)
    
    # Calculate downbeats (bar starts) based on time signature
    beats_per_bar = time_signature["numerator"]
    downbeats = []
    for i, beat in enumerate(beats):
        if i % beats_per_bar == 0:
            downbeats.append(beat)
    
    return {
        "tempo": round(tempo, 1),
        "beats": beats,
        "downbeats": downbeats,
        "time_signature": time_signature,
    }


def estimate_time_signature(y: np.ndarray, sr: int, beat_frames: np.ndarray) -> Dict[str, int]:
    """Estimate the time signature from audio.
    
    This uses onset strength analysis to detect patterns that suggest
    different time signatures. Currently supports 4/4, 3/4, and 6/8.
    
    Args:
        y: Audio time series
        sr: Sample rate
        beat_frames: Detected beat frame indices
        
    Returns:
        Dictionary with 'numerator' and 'denominator' keys
    """
    if len(beat_frames) < 8:
        # Not enough beats to analyze, default to 4/4
        return {"numerator": 4, "denominator": 4}
    
    # Get onset strength envelope
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    
    # Sample onset strengths at beat positions
    beat_strengths = []
    for frame in beat_frames:
        if frame < len(onset_env):
            beat_strengths.append(onset_env[frame])
        else:
            beat_strengths.append(0)
    
    if len(beat_strengths) < 8:
        return {"numerator": 4, "denominator": 4}
    
    # Analyze patterns for different time signatures
    # Check for 3/4 pattern (strong-weak-weak)
    score_3_4 = analyze_meter_pattern(beat_strengths, 3)
    # Check for 4/4 pattern (strong-weak-medium-weak)
    score_4_4 = analyze_meter_pattern(beat_strengths, 4)
    # Check for 6/8 pattern (strong-weak-weak-medium-weak-weak)
    score_6_8 = analyze_meter_pattern(beat_strengths, 6)
    
    # Choose the best matching time signature
    scores = {
        (3, 4): score_3_4,
        (4, 4): score_4_4,
        (6, 8): score_6_8,
    }
    
    best = max(scores, key=scores.get)
    return {"numerator": best[0], "denominator": best[1]}


def analyze_meter_pattern(beat_strengths: List[float], beats_per_bar: int) -> float:
    """Analyze how well beat strengths match a given meter pattern.
    
    Args:
        beat_strengths: List of onset strengths at beat positions
        beats_per_bar: Number of beats per bar to test
        
    Returns:
        Score indicating how well the pattern matches (higher is better)
    """
    if len(beat_strengths) < beats_per_bar * 2:
        return 0.0
    
    # Group beats into bars
    num_complete_bars = len(beat_strengths) // beats_per_bar
    if num_complete_bars < 2:
        return 0.0
    
    # Calculate average strength for each beat position within a bar
    position_strengths = [[] for _ in range(beats_per_bar)]
    for i, strength in enumerate(beat_strengths[:num_complete_bars * beats_per_bar]):
        position = i % beats_per_bar
        position_strengths[position].append(strength)
    
    avg_strengths = [np.mean(ps) if ps else 0 for ps in position_strengths]
    
    if not avg_strengths or max(avg_strengths) == 0:
        return 0.0
    
    # Normalize
    max_strength = max(avg_strengths)
    avg_strengths = [s / max_strength for s in avg_strengths]
    
    # Score based on expected pattern (first beat should be strongest)
    # For 4/4: beat 1 strongest, beat 3 medium, beats 2,4 weak
    # For 3/4: beat 1 strongest, beats 2,3 weak
    # For 6/8: beat 1 strongest, beat 4 medium, others weak
    
    score = avg_strengths[0]  # First beat should be strong
    
    if beats_per_bar == 4:
        # 4/4: expect beat 3 to be stronger than 2 and 4
        if len(avg_strengths) >= 4:
            score += 0.5 if avg_strengths[2] > avg_strengths[1] else 0
            score += 0.5 if avg_strengths[2] > avg_strengths[3] else 0
    elif beats_per_bar == 3:
        # 3/4: expect beat 1 much stronger than 2 and 3
        if len(avg_strengths) >= 3:
            score += 0.5 if avg_strengths[0] > avg_strengths[1] * 1.2 else 0
            score += 0.5 if avg_strengths[0] > avg_strengths[2] * 1.2 else 0
    elif beats_per_bar == 6:
        # 6/8: expect beat 1 and 4 to be stronger
        if len(avg_strengths) >= 6:
            score += 0.5 if avg_strengths[3] > avg_strengths[2] else 0
            score += 0.5 if avg_strengths[3] > avg_strengths[4] else 0
    
    return score
