# ThunderScope v0.13.1 validation

- Python syntax checks pass for app.py, host_audio.py and input_bridge.py.
- JavaScript syntax checks pass for map.js and settings.js.
- Key parser accepts ordinary keys, F-keys and Ctrl+Alt+number chords.
- v18/F13 defaults migrate to v19 chord defaults while custom mappings are preserved.
- Runtime `/map` and `/api/controls/status` smoke-tested on the packaging host.
- Actual Windows SendInput/War Thunder capture must be verified on Windows; use the documented Notepad `K` diagnostic.
