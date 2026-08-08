# ThunderScope v0.12.1 validation

Validation was run against a clean copy of the release tree.

## Static checks

- `app.py`, `host_audio.py` and `telemetry_values.py` compile with Python.
- Every frontend JavaScript file and the service worker pass `node --check`.
- The release contains 35 Betty WAV cues.
- The full release contains 2,269 VAICOM WAV clips.
- The clean release contains no generated `settings.json`, `navigation.json`,
  `thunderscope.db` or `lan_token.txt`.

## LAN security checks

- A non-loopback API request without a token returns HTTP 401.
- A non-loopback WebSocket connection without a token closes with code 4401.
- Opening the token-bearing map URL stores the authenticated cookie.
- API and WebSocket access succeed after authentication.
- `HOST=127.0.0.1` remains token-free.
- A non-loopback bind enables LAN authentication by default, even if the launcher
  environment flag is omitted.

## Audio queue checks

- A queued `gear-speed` warning is discarded when the gear-overspeed condition
  has cleared before playback.
- The same cue plays normally while the condition remains active.
- The stale-drop counter is exposed through the audio diagnostics response.

## Packaging checks

- The full package retains all audio and carrier/navigation features.
- The source/lite package excludes the VAICOM payload while retaining importers,
  Betty cues, licence notices and documentation.
- The hotfix contains no generated runtime state and no audio payload.
