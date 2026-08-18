# ThunderScope v0.12.5 Validation

## Scope

Map symbology restoration and busy VAICOM radio-net scheduling.

## Validation performed

- Python bytecode compilation passed for `app.py`, `host_audio.py`, `telemetry_values.py`, and the VAICOM importer.
- All frontend JavaScript files passed `node --check`.
- FastAPI started successfully and served `/settings`, `/map`, `/api/settings`, and `/api/audio/status`.
- Settings schema migrated to version 15.
- Old untouched 45–120 second chatter defaults migrate to 6–18 seconds while custom values are preserved.
- Busy traffic timing was sampled over 2,000 intervals: quick 2–5.5 second follow-ups, normal 6–18 second gaps, and occasional 24–42 second lulls were all observed.
- VAICOM library count: 2,269 WAV clips.
- Betty library count: 35 WAV clips.
- Map classification tests passed for Fighter, Bomber, Assault, Tracked, Wheeled, Airdefence, bombing point, defending point, and fighter respawn objects.
- Service-worker cache identifier bumped to v0.12.5 to prevent the tablet retaining the previous map renderer.

## Behaviour

Team colour still comes from War Thunder's object `color`. Symbol shape is derived from object `type` and `icon`, keeping affiliation and object class independent.

The radio channel remains independent from Betty and remains eligible on the carrier/ground unless the user explicitly enables airborne-only chatter.
