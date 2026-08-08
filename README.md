# ThunderScope v0.13.4

ThunderScope is a local War Thunder telemetry, tactical-map, host-audio and
flight-analysis dashboard. It reads the game's port `8111` and provides a
heading-up tablet map plus a separate secondary-monitor data display.








## v0.13.4 — quieter engine logic + transient flap notices

- Automatic engine-related Betty/tablet cues are retired: engine temperature, oil pressure, engine failure, engine mismatch, and check-afterburner.
- Tablet flap configuration notices now use a timed toast and clear automatically after 2.6 seconds.
- The underlying historical WAV assets remain packaged for attribution/history but are no longer active alerts.

## v0.13.3 — fuel-range ring repair

- Fixes the RNG ring radius conversion: physical metres are now converted into map-image pixels before drawing.
- Replaces noisy adjacent-sample fuel burn with a rolling 8–30 second estimator, making quantised fuel telemetry usable.
- Adds an always-visible RNG readout while enabled (`CAL` while learning, then estimated kilometres and endurance).
- Shows `> VIEW` when the true estimated range circumference lies beyond the current tablet viewport.
- Retains the 5 km heading-vector distance marks from v0.13.2.

## v0.13.1 — tablet TGP / A-G virtual control panel

- Added a touch-friendly **TGP** drawer directly on the tactical map. It opens on demand and leaves the rest of the map visible.
- Added one-to-one Windows keyboard injection using only the Python standard library; no process injection, game-memory access or multi-step macros.
- Default bindings are `CTRL+ALT+1` through `CTRL+ALT+0`, providing ten otherwise-unused combinations without consuming more reachable HOTAS/keyboard buttons. v0.13.1 uses Windows scan-code `SendInput`.
- Initial controls: TGP view, sight stabilisation, A/G weapon lock, laser designator, set/clear target point, next secondary weapon, fire secondary weapon, and hold-to-use TGP zoom +/- controls.
- TGP drawer can open on the right, left or bottom and auto-hides after 20 seconds of inactivity by default. Any panel interaction resets the timer.
- Opening TGP mode closes the Route Planner and temporarily suppresses the carrier HUD so the tablet is not buried under overlays.
- Added a release-all failsafe on browser focus loss, visibility changes, server shutdown and an explicit API endpoint to prevent held zoom controls becoming stuck.
- Added Settings configuration for panel position, auto-hide and every virtual-key binding.
- Windows-only for v0.13.1. Linux telemetry/audio remain supported; the virtual aircraft-control bridge reports unavailable on non-Windows hosts.

### v0.13.1 input compatibility note

v0.13.0 used F13–F22 with the legacy Windows `keybd_event` API. v0.13.1 switches to Ctrl+Alt+number chords and scan-code `SendInput`. If War Thunder still captures nothing, temporarily map TGP VIEW to `K` and test it in Notepad; a typed `k` proves the Windows bridge works and isolates the issue to game-side input capture.

## v0.12.6 — heading vector + true player-centred map

- Added a **VEC** map control that draws a solid magenta heading vector from the nose of the player aircraft to the edge of the display.
- The vector follows the aircraft correctly in both heading-up and north-up modes.
- Removed map-edge camera clamping in normal follow mode. The player aircraft now stays centred even at the extreme edge of the War Thunder tactical map; empty space may appear beyond the source map boundary rather than pushing the aircraft off-centre.
- Existing zoom, pinch zoom, pan, reset/recentre, HDG/N modes, route planning, carrier aid and symbology are retained.

## v0.12.5 — map symbology + busy radio net

- Route Planner and Carrier Landing Assistant now start closed instead of occupying the map.
- `NAV` toggles the route planner, `LSO` arms/hides the carrier approach HUD, and `HIDE` dismisses both large overlays.
- Hidden overlays use `display:none` plus disabled pointer interaction, so they cannot block map taps.
- Carrier setup is collapsed by default, and the LSO HUD only renders on the inbound side of the deck.
- Route markers remain directly removable by tapping them when no placement mode is active.
- VAICOM chatter is decoupled from the 70 km/h Betty inhibit and can play while parked/taxiing/on a carrier.
- Ground/deck chatter is enabled by default; the existing Settings switch can restore airborne-only chatter.
- Betty remains inhibited at or below 70 km/h and intentional engine-off states remain protected from false engine-failure warnings.

## v0.12.3 — tablet route-planner usability

- Fixed the route planner close button: hidden panels now leave the layout/hit-test tree instead of remaining invisibly over the map.
- Added a large **HIDE** button beside **NAV** for damaged/small touchscreens.
- Tap an existing route marker on the map (with no placement mode active) to remove it via a large confirmation dialog.
- Carrier approach HUD/callouts stay suppressed while IAS is 70 km/h or below, so setup clutter does not activate while parked on a carrier deck.

## v0.12.2 — simple LAN access + carrier-deck Betty inhibit

- LAN mode is back to simple trusted-local-network access. `run_lan` binds to
  `0.0.0.0:8765`; there are no query tokens, cookies, token files or API/WebSocket
  authentication steps.
- Automatic Betty warnings and gear/flap/airbrake callouts are suppressed at or
  below **70 km/h** by default. This prevents a parked aircraft on a moving carrier
  from generating airborne warnings. Manual Settings audio previews still play.
- The low-speed threshold is visible in Settings and remains adjustable per install.
- Engine-failure detection now requires a real RPM collapse from a previously
  running engine. An engine that is already shut down no longer triggers the cue.
- All v0.12.1 stale-alert, repository-hygiene and frontend escaping fixes remain.

For LAN use, open `http://HOST-LAN-IP:8765/map` directly. Only use LAN mode on a
network you trust.

## v0.12.1 — repository and alert-queue hardening

This maintenance release keeps all v0.12.0 carrier and v0.11.0 navigation
features while tightening the project around real-world use and GitHub publishing.
The short-lived LAN token experiment from that release was removed again in v0.12.2.

- Generated settings, routes and databases are ignored by Git. A clean
  `data/settings.example.json` remains as a reference template.
- The 2,269-file VAICOM library is ignored in source repositories but retained in the
  full release ZIP. The importer scripts remain for source/lite installations.
- Condition-bound audio alerts are checked again immediately before playback. A queued
  gear, flap, stall, G, fuel or engine warning is discarded if the condition has already
  cleared.
- Server-originated vehicle, profile, route, voice and theme names are HTML-escaped
  before use in template-generated interface elements.
- Dense telemetry-loop code has been expanded and type-annotated to make future diffs
  and merges easier to review.

For normal home use, v0.12.2 restores direct trusted-LAN access with no token.

## v0.12.0 — synthetic carrier landing aid

The tablet map can now be configured as a generic carrier-approach trainer. Open
**NAV**, expand **Carrier landing aid**, press **Mark stern + bow**, then tap the
stern and bow ends of the landing deck. The marked direction is the landing
direction. Enter the approximate deck altitude and load or tune the aircraft
approach profile before commencing the approach.

Carrier features:

- Draws the deck, touchdown reference and extended final-approach line.
- Activates a dedicated synthetic-LSO display inside the configured approach range.
- Calculates deck heading, distance to touchdown, line-up error and glidepath error.
- Shows IAS, AoA, bank, sink rate, gear and flap state alongside a moving guidance ball.
- Provides measured-condition LSO callouts for glidepath, line-up, speed, AoA, bank,
  sink rate, configuration, distance milestones and wave-off.
- Uses separate LSO voice, rate and volume settings while retaining normal Betty and
  VAICOM playback behaviour.
- Supports aircraft-specific approach IAS, target AoA, AoA tolerance, maximum final
  bank, maximum sink rate and glidepath angle.
- Applies conservative wave-off logic close to the deck.
- Grades completed passes using touchdown line-up, glide error, sink rate, IAS, AoA,
  bank and configuration.
- Labels outcomes as **Likely arrested**, **Bolter**, **Deck crossing** or **Wave-off**
  because port 8111 does not expose a reliable arresting-wire/hook engagement flag.

### Carrier setup

1. Enter a test flight or match and open `/map` on the tablet.
2. Press **NAV** and expand **Carrier landing aid**.
3. Press **Mark stern + bow**.
4. Tap the stern end of the angled landing area, followed by its bow end.
5. Enter the approximate carrier-deck altitude above the map datum.
6. Press **Load aircraft profile**, then adjust approach IAS/AoA limits as required.
7. Leave spoken callouts, conservative wave-off and pass grading enabled.
8. Close the planner and fly onto the dashed final line. The carrier HUD appears
   automatically inside the selected activation distance.

The map's previous heading-up/north-up, zoom, pan, pinch, recenter, fullscreen,
route-planning, target, home-airfield and ETA controls are unchanged.

### Carrier limitations

- The first implementation uses manually marked, fixed deck points. On a moving
  carrier, mark the deck again if its map position has shifted materially.
- Deck altitude is entered manually; incorrect altitude produces incorrect vertical
  guidance.
- The guidance is a synthetic training aid, not a simulation of a specific aircraft's
  optical landing system or shipboard equipment.
- Successful arrest, bolter and touchdown are inferred from position, altitude,
  vertical motion and ground-speed changes. They cannot be treated as authoritative.
- Aircraft approach values vary greatly. Generic defaults are deliberately broad;
  tune or save a profile for each aircraft used regularly.

## v0.11.0 — mission navigation and route planning

The tablet tactical map now doubles as a lightweight mission-navigation display.
Press **NAV** on the map to create and manage a route before or during a sortie.

New navigation features:

- Add custom waypoints anywhere on the map.
- Tap recognised objective/base icons to select a target point.
- Tap runway lines to set a home or divert airfield.
- Draw a complete multi-leg route from the aircraft through all planned points.
- Show live bearing, distance, steering correction, map-derived ground speed and ETA.
- Show the estimated clock time of arrival for the active point.
- Show direct bearing, distance and ETA to the selected home airfield.
- Automatically advance to the next route point inside a configurable arrival radius.
- Reorder, rename, activate, pause and remove route points from the tablet.
- Preserve the active plan across browser refreshes through `data/navigation.json`.
- Clear stale routes automatically when War Thunder reports a new map generation.
- Extend the selected home runway centreline and show cross-track offset inside 20 km.

### Creating a route

1. Open `/map` and press **NAV**.
2. Select **TARGET**, **HOME**, **DIVERT** or **+ WAYPOINT**.
3. Tap an existing map objective/runway, or tap empty map space for a custom point.
4. Repeat to build the required sequence.
5. Use the arrow buttons beside a route entry to reorder it.
6. Press an entry itself to make that point the active destination.
7. Leave automatic advancement enabled, or use **PREV** and **NEXT** manually.

The active navigation card remains visible when the planner is closed. Its ETA is
calculated using smoothed ground speed measured from consecutive tactical-map
positions rather than indicated airspeed.

### Navigation limitations

- Routes are straight segments between points; terrain and threat avoidance remain manual.
- The feature guides the aircraft to a selected point but does not calculate bomb release, CCIP or weapon ballistics.
- Friendly/enemy ownership is not inferred for manually selected airfields; select the correct home runway yourself.
- Runway guidance is geometric centreline guidance only. War Thunder does not provide a reliable runway elevation for a synthetic glidepath.
- Distance and ETA require valid `map_min` and `map_max` scale data. Route drawing still works if scale data is unavailable.

## v0.10.3 — complete Betty playback repair

- Rebuilt all 35 active Betty WAVs from the original uploaded MP3 recordings.
- Removed the destructive silence trimming that shortened several phrases.
- Added a 120 ms tail guard so final syllables complete cleanly.
- Increased Linux PipeWire alert buffering from 35 ms to 120 ms to reduce underruns.
- Preserved independent VAICOM chatter and Betty playback channels.

## v0.10.2 — independent radio and Betty channels

Radio chatter and Betty warnings now use independent playback tasks. An active
VAICOM or crew transmission continues while a warning, configuration callout,
or TTS message plays over it. This matches the intended cockpit behaviour and
removes the old warning-priority cut-off.

The settings page adds:

- **Keep chatter playing underneath Betty warnings** — enabled by default.
- **Radio chatter volume** — independent from the Betty/host-alert volume.
- The legacy post-warning silence value applies only when overlap is disabled.

On Windows, chatter runs through a dedicated PowerShell/WPF media process while
Betty retains its existing WAV/TTS path. On Linux, the existing PipeWire,
PulseAudio, FFmpeg, mpv or ALSA subprocess remains independent from the warning
player.

## v0.10.1 — bundled VAICOM chatter and matching gear warning

This build bundles the extracted VAICOM Community chatter library directly, so
no Git clone or importer run is needed. It includes 2,269 valid PCM WAV clips
across Navy, NATO, Red Flag, Fallon, Andersen, Russia, WWII and Afghanistan.
Navy is the default selected theme for a fresh installation; ambient chatter
still remains disabled until enabled in Settings.

The last mismatched Betty cue, `gear-speed.wav`, has also been replaced with the
user-supplied matching Bitchin' Betty recording. All active safety and control
cues now use the same user-created voice set.

## v0.10.0 — expanded Betty telemetry cues

This build integrates the user's 34-clip Bitchin' Betty pack and adds the
telemetry/state logic needed by the newly supplied cues.

New active cues:

- Joker fuel
- Engine temperature
- Oil pressure
- Engine failure
- Check gear
- Check flaps
- Check afterburner
- Positive rate
- Don't sink
- Hard landing
- Energy low
- Aircraft overspeed
- Speedbrake
- Telemetry restored

Existing fuel, G, AoA, stall, sink-rate, Mach-one, gear/flap/airbrake and engine
mismatch cues remain active. Every implemented cue has a bundled WAV override.

## How the new checks work

The rules are intentionally conservative and automatically skip a cue when the
required telemetry field is unavailable:

- **Engine temperature:** checks oil, water/coolant and cylinder-head temperature
  values against the active aircraft profile.
- **Oil pressure:** learns each reported oil-pressure channel's normal in-flight
  value and warns after a large drop while an engine is still running.
- **Engine failure:** learns normal engine RPM and detects a major RPM collapse
  while meaningful throttle remains applied. This also works on single-engine
  aircraft, unlike the existing engine-mismatch warning.
- **Check gear:** requires a descending, low-speed approach with landing flaps
  selected and the gear not fully down.
- **Check flaps:** requires a descending, low-speed approach with gear down and
  flaps still retracted.
- **Check afterburner:** fires only when afterburner/WEP is detected at or below
  the Bingo-fuel threshold.
- **Positive rate / Don't sink:** a short take-off state machine is armed after
  the aircraft accelerates from a recent stationary state.
- **Hard landing:** requires a configured landing approach, a high pre-flare sink
  rate, near-zero vertical speed and deceleration. It remains a derived estimate
  because port 8111 does not provide a documented weight-on-wheels flag.
- **Energy low:** optional combat-coach rule based on G, low IAS and rapid speed
  loss. It is disabled by default to avoid nuisance warnings.
- **Aircraft overspeed:** uses a profile-specific IAS limit and is disabled by
  default until that limit is set for the aircraft.
- **Speedbrake:** warns when the airbrake remains extended while high throttle is
  applied.
- **Telemetry restored:** announces reconnection after a genuine telemetry-loss
  state, while preserving the existing stationary-audio suppression.

All thresholds and cue toggles are available at:

```text
http://127.0.0.1:8765/settings
```

## Linux quick start (Ubuntu/Debian)

```bash
cd thunderscope-dashboard
chmod +x *.sh
./install_linux_dependencies.sh
./run_lan.sh
```

Do not run the server with `sudo`; PipeWire/PulseAudio normally belongs to your
logged-in desktop session.

Open on the host:

```text
http://127.0.0.1:8765/data
http://127.0.0.1:8765/settings
```

`run_lan.sh` prints the tablet-map URL, for example:

```text
http://HOST-LAN-IP:8765/map
```

Open that address directly on the tablet while both devices are on the same trusted LAN.

With UFW enabled, allow the dashboard from the local network, for example:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 8765 proto tcp
```

Linux WAV playback automatically tries PipeWire `pw-play`, `paplay`, FFmpeg
`ffplay`, `mpv`, then ALSA `aplay`. TTS prefers `spd-say` and falls back to
`espeak-ng`.

## Windows quick start

Run `run_lan.bat`, allow Python on Private networks, then open the same URLs.
Windows uses SAPI for fallback TTS and native WAV playback.

## VAICOM chatter

The **full release ZIP** bundles the complete chatter library under:

```text
audio/radio/vaicom/
```

Open Settings, enable **Ambient radio chatter**, choose **VAICOM radio net** or
**Mixed crew + radio net**, and select a theme. Recommended first choices are
**Navy** and **NATO**. By default, Betty warnings play over chatter without stopping the transmission.

The Afghanistan theme contains real-world combat communications and may be
confronting. It is included because it was present in the user-supplied archive,
but it is never selected automatically.

The smaller source/lite release excludes those 2,269 files to keep Git clones
manageable. Its importer scripts can install chatter from a local VAICOM ZIP or
folder. The same scripts remain useful for refreshing a full installation later.

## Running away from the game PC

By default ThunderScope reads `http://127.0.0.1:8111`. A separate host can be
specified with:

```bash
WT_BASE_URL=http://WAR-THUNDER-PC-IP:8111 ./run_lan.sh
```

This requires the game PC to permit LAN access to port 8111.

## Existing features

- Heading-up tablet tactical map with smooth 10 Hz follow, route planning, target/home guidance and alerts
- Adaptive flight dashboard and landing assistance
- Host Betty alerts with per-cue WAV overrides
- Cross-platform Windows/Linux audio playback
- Phase-aware internal crew chatter plus 2,269 bundled VAICOM theme clips
- Background session recording and after-action reports
- Aircraft-specific thresholds and settings import/export

## Upgrade

Extract v0.12.2 over the existing folder while retaining:

```text
data/settings.json
data/thunderscope.db
data/navigation.json
```

Existing settings migrate automatically. Clear the tablet kiosk browser cache
once because the service-worker version changed.
