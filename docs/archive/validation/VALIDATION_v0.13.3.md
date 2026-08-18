# ThunderScope v0.13.3 validation

- Python syntax: `app.py` and `host_audio.py` compile successfully.
- JavaScript syntax: `static/js/map.js` and `static/service-worker.js` pass `node --check`.
- Fixed RNG circle units: metres/map extent are converted to map-image pixel radii before Canvas ellipse drawing.
- Fuel burn estimation now uses a rolling 8–30 second sample window rather than adjacent 10 Hz samples.
- Refuel/rearm increases reset the rolling burn estimator.
- RNG display shows `CAL` while collecting enough data and then shows estimated range/endurance.
- RNG display reports `> VIEW` when the actual estimated circumference is outside the visible tablet viewport.
- 5 km heading-vector range ticks remain enabled with VEC.
