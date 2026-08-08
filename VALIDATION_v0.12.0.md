# ThunderScope v0.12.0 validation

Validation performed on the packaged source before release:

- Python compilation: `app.py`, `host_audio.py`, `telemetry_values.py` and the VAICOM importer.
- JavaScript syntax checks: map, settings, flight-data, reports and landing-page scripts.
- FastAPI lifespan/API test for health, navigation version 2 persistence, carrier-state sanitisation and LSO callout validation.
- Browser-logic simulation using a 20 km square map, a manually defined carrier and live aircraft telemetry.
- Carrier geometry result: approximately 5.1 km final distance, zero cross-track error and valid configuration detection.
- Navigation and carrier controls confirmed alongside the existing map zoom, pan, pinch, recenter and orientation controls.
- Audio inventory confirmed: 35 Betty WAV cues and 2,269 VAICOM chatter clips.
- Package cleaned of test navigation routes, telemetry databases, temporary files and Python bytecode.

The synthetic system still requires real War Thunder carrier approaches to calibrate
map-object behaviour, deck altitude, aircraft IAS/AoA profiles and outcome thresholds.
