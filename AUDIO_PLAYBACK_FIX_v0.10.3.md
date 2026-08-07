# Audio playback repair — v0.10.3

Several Betty WAV files in previous builds were shortened by an overly aggressive
silence-removal conversion. v0.10.3 rebuilds all 35 active cues directly from the
user-supplied MP3 recordings without silence trimming.

Each repaired file is:
- mono
- 44.1 kHz
- 16-bit PCM WAV
- loudness-normalised
- given a 120 ms tail guard to prevent the final syllable being clipped

Linux PipeWire playback latency was also increased from 35 ms to 120 ms to avoid
underruns under game load.
