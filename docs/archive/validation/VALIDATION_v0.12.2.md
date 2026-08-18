# ThunderScope v0.12.2 validation

Validated on 2026-08-07.

- Python syntax passed for `app.py`, `host_audio.py`, `telemetry_values.py`, and the VAICOM importer.
- Frontend JavaScript syntax passed for all dashboard scripts and the service worker.
- Application startup passed while bound to `0.0.0.0`.
- Bare `/settings`, `/api/health`, and `/api/server-info` requests succeed without a LAN token.
- No active application, launcher, frontend, or security file contains the removed token/cookie authentication implementation.
- Existing settings older than version 13 migrate the automatic Betty/control-cue inhibit threshold to 70 km/h.
- Automatic cues are inhibited at or below 70 km/h while manual Settings audio tests remain force-playable.
- An engine that is already stopped does not trigger `engine-failure`.
- A deliberate low-throttle engine shutdown does not trigger `engine-failure`, including if throttle is advanced again while RPM is already zero.
- A previously healthy engine whose RPM collapses below the configured threshold under power does trigger `engine-failure`.
- Engine RPM recovery clears the latched failure condition.
- v0.12.1 dequeue-time stale-alert checking remains present.
- Full-release audio inventory remains intact: 35 Betty WAV cues and 2,269 VAICOM chatter WAV clips.
