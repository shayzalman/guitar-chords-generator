
import os
import wave
import numpy as np
import vamp
import librosa
import sys
import tempfile
import time

def test_full_process():
    # Create a 2 minute dummy audio to stay within timeout but test "long" audio
    sample_rate = 44100
    duration = 120.0 
    print(f"Generating {duration}s of audio...")
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio = np.sin(440 * t * 2 * np.pi).astype(np.float32)
    
    with tempfile.TemporaryDirectory() as td:
        wav_path = os.path.join(td, "in.wav")
        with wave.open(wav_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes((audio * 32767).astype(np.int16).tobytes())
        
        print(f"Created {wav_path} (size: {os.path.getsize(wav_path)} bytes)")
        
        os.environ['VAMP_PATH'] = '/usr/local/lib/vamp'
        
        # Test Chordino
        print("--- Testing Chordino ---")
        start_time = time.time()
        with wave.open(wav_path, 'rb') as wf:
            sr = wf.getframerate()
            nc = wf.getnchannels()
            nf = wf.getnframes()
            rd = wf.readframes(nf)
        audio_np = np.frombuffer(rd, dtype=np.int16).astype(np.float32) / 32768.0
        
        print("Calling vamp.collect...")
        try:
            results = vamp.collect(audio_np, sr, "nnls-chroma:chordino", output="simplechord")
            print(f"Chordino Success! Got {len(results.get('list', []))} chords in {time.time() - start_time:.2f}s")
        except Exception as e:
            print(f"Chordino FAILED: {e}")

        # Test Librosa (detect_beats)
        print("--- Testing Librosa ---")
        start_time = time.time()
        try:
            y, sr_l = librosa.load(wav_path, sr=None, mono=True)
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr_l)
            print(f"Librosa Success! Tempo: {tempo} in {time.time() - start_time:.2f}s")
        except Exception as e:
            print(f"Librosa FAILED: {e}")

if __name__ == "__main__":
    try:
        test_full_process()
    except Exception as e:
        print(f"Caught top-level exception: {e}")
        import traceback
        traceback.print_exc()
