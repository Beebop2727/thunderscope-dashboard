# ThunderScope v0.12.7 validation

- Python syntax: `app.py` and `host_audio.py` compile successfully.
- Added louder radio chatter defaults: `radioChatterVolume=70`, `radioChatterGainDb=10`, `radioChatterCockpitFx=true`.
- Added optional cockpit-radio processing for chatter playback.
- Chatter processing creates a temporary boosted/mono/band-limited WAV and cleans it up after playback.
- Settings UI now exposes `Radio gain boost (dB)` and `Apply cockpit-radio processing`.
- Existing audio/data folders remain compatible.
