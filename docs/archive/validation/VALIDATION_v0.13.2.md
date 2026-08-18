# ThunderScope v0.13.2 validation

- Python syntax: `app.py` and `host_audio.py` compile successfully.
- JavaScript syntax: `static/js/map.js` passes `node --check`.
- Added `RNG` toggle to the map UI for an estimated fuel-range ring.
- Fuel range estimate is computed client-side from smoothed fuel burn (kg/s) and smoothed ground speed.
- Added 5 km increment tick marks and labels along the heading vector.
- Aircraft-centred map behaviour, navigation, TGP, LSO, and audio assets remain unchanged.
