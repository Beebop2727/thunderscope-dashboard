# ThunderScope v0.13.4 validation

- `app.py` and `host_audio.py` compile successfully.
- `static/js/map.js` and `static/js/settings.js` pass `node --check`.
- Automatic engine-related cues are absent from active host-audio definitions/evaluation and tablet map alert logic.
- Settings UI no longer exposes engine cue toggles, thresholds, or manual preview entries.
- Existing settings migrate to version 20 and force retired engine alert flags off.
- Flap state changes use `showMapToast()`, whose timer hides the notice after 2.6 seconds.
- Initial telemetry does not generate a false flap-change notice; only subsequent state transitions do.
- Service-worker/static asset cache bumped to v0.13.4.
