# ThunderScope v0.11.0 validation

Validated against a simulated live War Thunder port-8111 source with:

- a 65.536 km square map scale
- moving player-aircraft coordinates at 10 Hz
- two runway/airfield objects
- bombing-point and capture-zone objects
- live IAS, altitude and heading telemetry

Checks completed:

- Python syntax and module compilation
- JavaScript syntax for every dashboard script and the service worker
- navigation payload validation, bounds checking and route reset
- target/home route rendering
- bearing, physical distance, ground-speed and ETA updates
- route-planner opening and point-list rendering
- tap-to-create target interaction
- persistent navigation API create/read/update/delete behaviour
- full audio inventory retained: 2,269 VAICOM WAVs and 35 Betty WAVs
- generated test route and session database removed before packaging
