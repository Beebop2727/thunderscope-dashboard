# ThunderScope v0.12.4 Validation

Validated fixes for the tablet overlay and radio-chatter regression:

- Python modules compile successfully.
- `static/js/map.js` and `static/js/settings.js` pass Node syntax checking.
- FastAPI starts and serves `/map`, `/settings`, `/api/health` and `/api/audio/status` without War Thunder running.
- LAN mode remains token-free; the v0.12.1 token/cookie layer is not active.
- Route Planner starts hidden and hidden navigation surfaces use `display:none` plus `pointer-events:none`.
- Carrier Landing Assistant starts hidden; carrier setup is collapsed by default.
- Added bottom `LSO` toggle beside `NAV`; `HIDE` dismisses both the Route Planner and carrier HUD.
- Carrier HUD only renders on the inbound side of the touchdown point and still requires IAS above 70 km/h when IAS is available.
- Route markers retain direct tap-to-remove behaviour when no placement mode is active.
- The 70 km/h stationary inhibit remains applied to Betty/control warnings.
- VAICOM chatter no longer reads the Betty stationary-inhibit flag, so radio traffic can continue while parked or taxiing.
- Ground/carrier-deck chatter is enabled by default; users can restore airborne-only behaviour from Settings.
- Existing v13 settings migrate to v14 with ground/deck chatter enabled and the Betty threshold retained at 70 km/h.
- Enabling chatter schedules the first ambient transmission within roughly 4–10 seconds, after which normal configured random intervals apply.
- Settings diagnostics show the approximate countdown to the next scheduled random chatter clip.
- Full audio inventory preserved: 35 top-level Betty WAV cues and 2,269 VAICOM chatter WAVs.
- Clean release `data/` contains only `README.txt` and `settings.example.json`.
