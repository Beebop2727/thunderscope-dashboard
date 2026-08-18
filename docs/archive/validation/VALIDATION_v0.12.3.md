# ThunderScope v0.12.3 Validation

Validated changes for the tablet route-planner usability patch:

- Python modules compile successfully.
- `static/js/map.js` passes Node syntax checking.
- FastAPI starts and serves `/map` and `/api/health` without War Thunder running.
- `/map` contains the dedicated `HIDE` button beside `NAV`.
- `toggleNavigationPanel(false)` now applies a true hidden state to the route planner.
- Hidden navigation/carrier UI surfaces use `display:none` and `pointer-events:none`, so they cannot intercept map taps.
- Existing X close control and new HIDE control both call the same close path.
- Route markers have a direct touch target: tapping a marker with no placement mode active offers removal through a native confirmation dialog.
- Route-list removal uses the same central removal helper.
- Carrier approach HUD/callouts require IAS > 70 km/h when IAS is available, preventing approach clutter while parked on a carrier.
- Existing map zoom, pan, recenter, heading-up/north-up, alerts, fullscreen, route rendering and carrier setup code remains present.
- Audio inventory preserved: 35 top-level Betty WAV cues and 2,269 VAICOM chatter WAVs in the full build.
- Clean `data/` directory contains only `README.txt` and `settings.example.json`.
