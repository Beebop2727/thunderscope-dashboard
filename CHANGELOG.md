# v0.13.4

- Retired automatic engine-related Betty/tablet cues: engine temperature, oil pressure, engine failure, engine mismatch, and check-afterburner.
- Flap configuration changes on the tablet now use a guaranteed transient toast and clear after 2.6 seconds.
- Bumped the map/service-worker cache so tablets do not retain the old alert behaviour.

# v0.13.3

- Fixed invisible RNG ring caused by normalised-distance values being passed directly to pixel-space canvas drawing.
- Fuel burn now uses an 8–30 second rolling window instead of adjacent 10 Hz samples.
- Added RNG calibration/estimate readout and `> VIEW` indication.

# ThunderScope changelog

## 0.13.1

- Replaced legacy Windows `keybd_event` with scan-code `SendInput`.
- Added keyboard-chord support.
- Migrated untouched F13–F22 defaults to `CTRL+ALT+1` through `CTRL+ALT+0`; custom mappings are preserved.
- Added a documented Notepad `K` diagnostic to distinguish Windows input problems from War Thunder filtering.

## 0.13.0

- Added tablet TGP / air-to-ground virtual control drawer.
- Added Windows one-key input bridge with F13–F22 defaults.
- Added tap and hold/release control actions plus stuck-key release failsafes.
- Added control-binding, panel-position and auto-hide settings.
- Opening TGP mode dismisses competing route/carrier overlays while keeping the map visible.

# v0.12.6 — Heading Vector + True Player-Centred Map

- Added a toggleable solid heading vector (`VEC`) projected from the aircraft nose.
- Heading vector is independent of route guidance and remains correct in HDG and north-up modes.
- Removed viewport edge clamping that displaced the aircraft near tactical-map boundaries.
- Player remains centred in follow mode; the renderer may show empty margin outside the tactical-map image at map edges.
- Preserved manual pan, zoom, recenter, route planner, LSO, Betty, VAICOM and v0.12.5 map symbology.

# v0.12.5 — Map Symbology + Busy Radio Net

- Restores distinct map symbology using War Thunder `type` + `icon` data: fighter, bomber, assault aircraft, tracked, wheeled and air-defence ground units, bombing/defending objectives, respawn bases and ships.
- Team affiliation remains driven by War Thunder object colour; symbol shape now carries object class.
- Adds radio traffic density presets. `Busy operational net` is the default and uses clustered transmissions with occasional natural lulls.
- Migrates the old 45–120 second default chatter interval to 6–18 seconds for existing installations that never customised it.
- First chatter after enabling is scheduled within roughly 1.5–4 seconds.

# Changelog

## 0.12.4

- Fixed Route Planner and Carrier Landing Assistant visibility on tablet layouts.
- Added dedicated LSO and HIDE controls beside NAV.
- Collapsed carrier setup by default and limited the carrier HUD to inbound approaches.
- Decoupled VAICOM chatter from the 70 km/h Betty low-speed inhibit.
- Enabled ground/carrier-deck chatter by default while retaining the airborne-only option.

## 0.12.3

- Fix route planner hide/close hit-testing on the map.
- Add dedicated HIDE control beside NAV.
- Allow direct route-point removal by tapping its map marker.
- Suppress carrier approach HUD below/equal 70 km/h IAS.

## 0.12.2

- Removed the v0.12.1 LAN token/cookie authentication layer; trusted-LAN mode again opens directly on port 8765.
- Raised the default automatic Betty/control-cue low-speed inhibit threshold to 70 km/h, including automatic migration of older settings.
- Added a visible low-speed Betty inhibit threshold control to Settings.
- Reworked engine-failure detection to require an RPM collapse from a previously healthy engine, preventing false alerts for engines that are already shut down.
- Preserved v0.12.1 stale-queue checking, generated-state Git hygiene, escaping and source/full release split.

## 0.12.1

- Added shared-token protection for non-loopback LAN API and WebSocket access.
- Added persistent token generation, authenticated tablet URLs and one-step token rotation.
- Stopped tracking generated settings, navigation plans, databases and LAN credentials.
- Added separate source/lite and full-release packaging guidance for the VAICOM library.
- Added dequeue-time relevance checks so cleared flight warnings are not spoken late.
- Added stale-alert diagnostics to the host-audio status endpoint.
- Escaped server-originated strings used by reports, settings and route templates.
- Reformatted and annotated the telemetry hub and settings loader for maintainability.
- Updated browser cache and application versioning to 0.12.1.

## 0.12.0

- Added manual stern/bow carrier-deck setup with configurable deck altitude, glidepath, touchdown offset and activation range.
- Added an extended final line, touchdown marker and dedicated synthetic carrier-approach HUD.
- Added live deck heading, distance, centreline error, glidepath error, IAS, AoA, bank, sink-rate, gear and flap monitoring.
- Added host-side LSO TTS callouts with independently selectable voice, rate and volume.
- Added distance milestones, measured-condition corrective callouts and conservative close-in wave-off logic.
- Added aircraft-specific carrier approach IAS, AoA, bank, sink-rate and glidepath settings.
- Added inferred likely-arrested, bolter, deck-crossing and wave-off outcomes with configurable pass grading.
- Preserved all navigation, map controls, Betty cues and 2,269 VAICOM chatter clips.
- Updated application, browser cache and package versioning to 0.12.0.

## 0.11.0

- Added tablet-map mission planning with custom waypoints, target, home and divert roles.
- Added persistent route storage and cross-device synchronisation through `/api/navigation`.
- Added map-scale-aware bearing, distance, route length and ETA calculations.
- Added smoothed map-derived ground speed and estimated arrival clock time.
- Added active-leg steering correction, closing/moving-away trend and automatic waypoint advancement.
- Added route editing, point renaming, reordering, manual leg selection and configurable arrival radius.
- Added direct home-airfield guidance and runway centreline/cross-track approach assistance.
- Added automatic stale-route clearing when the War Thunder map generation changes.
- Updated application, browser cache and package versioning to 0.11.0.

## 0.10.3

- Rebuilt all 35 Betty cue WAVs from the original MP3 files without aggressive silence removal.
- Added a short end-of-file tail guard to stop final words being clipped.
- Increased Linux PipeWire playback latency to 120 ms for reliability under load.
- Added source-to-cue mapping and playback repair documentation.

## 0.10.2

- Split ambient chatter and Betty alerts into independent playback tasks.
- Kept active radio transmissions playing while WAV or TTS warnings are announced.
- Added a dedicated Windows chatter player process so Windows can mix both channels.
- Added independent radio-chatter volume and an overlap compatibility toggle.
- Retained the older interruption/quiet-period behaviour as an opt-out setting.

## 0.10.1

- Bundled 2,269 VAICOM Community chatter clips across eight selectable themes.
- Defaulted fresh chatter-source selection to VAICOM/Navy while keeping chatter opt-in.
- Replaced the remaining older `gear-speed.wav` with the user's matching Betty recording.
- Preserved the VAICOM MIT licence and added bundled-source metadata.
- Updated application and browser-cache versioning to 0.10.1.

## 0.10.0

- Integrated 34 user-supplied Bitchin' Betty recordings as normalised PCM WAV cues.
- Added Joker fuel, engine temperature, oil pressure, engine failure, approach-configuration, take-off, hard-landing, energy-low, overspeed, speedbrake and telemetry-restored alert logic.
- Added per-aircraft thresholds and enable switches for all new derived cues.
- Added every new cue to the Settings preview selector.
- Preserved stationary audio suppression; v0.10.2 later moved chatter to an independent channel.
- Updated application and browser-cache versioning to 0.10.1.

## 0.9.3

- Added a new Betty-derived `flaps-up.wav` assembled from the user-supplied “Flaps down” and “Gear up” clips.
- Added provisional hybrid `flaps-combat.wav` and `airbrake-retracted.wav` cues so those events no longer fall back to the host computer's older TTS voice.
- The words “flaps” and “airbrake” remain sourced from the user-supplied Betty pack; the unavailable words “combat” and “retracted” are provisionally synthesised and cockpit-EQ matched until dedicated Betty recordings are supplied.
- Added explicit WAV overrides so upgrades no longer retain or expose stale legacy sounds for these three cue IDs.
- Updated application, cache and package versioning to 0.9.3.

## 0.9.2

- Integrated seventeen user-generated Bitchin' Betty TTS recordings as normalised PCM WAV overrides.
- Changed the high-angle voice phrase and custom recording from “Angle of attack” to “AoA.”
- Added custom audio for critical fuel, AoA, flap overspeed, telemetry loss, Mach one, gear up/down, flap deployment modes and airbrake extension.
- Replaced the earlier mixed-source fuel, G, stall, engine and sink-rate cues with the new consistent voice pack.
- Expanded the settings preview menu to every implemented warning and configuration callout.
- Updated application, cache, importer and package versioning to 0.9.2.


## 0.9.1

- Added a bundled custom `sink-rate.wav` alert supplied by the user.
- Converted the source MP3 to mono 44.1 kHz, 16-bit PCM WAV for Windows and Linux playback.
- Normalised the clip to match the existing Betty warning pack.
- The custom clip now automatically replaces sink-rate TTS when WAV overrides are enabled.
- Updated application, cache, importer and package versioning to 0.9.1.

## 0.9.0

- Added native Linux host-audio support for Betty WAV clips and radio chatter.
- Added PipeWire (`pw-play`), PulseAudio (`paplay`), FFmpeg, mpv and ALSA playback fallbacks.
- Added Linux TTS through Speech Dispatcher with eSpeak NG fallback and Linux voice discovery.
- Preserved warning-priority interruption of long chatter clips on Linux.
- Added Linux launchers, a Linux VAICOM importer wrapper and an Ubuntu/Debian dependency installer.
- Added safeguards against running the audio service with sudo outside the desktop sound session.
- Updated settings, diagnostics, cache and package versioning for cross-platform host audio.

## 0.8.3

- Added an optional VAICOM Community chatter importer with direct download and local ZIP/folder modes.
- Separated internal RIO/WSO crew clips from external VAICOM radio-net recordings.
- Added Crew, VAICOM and Mixed chatter-source modes.
- Added selectable VAICOM themes with live clip counts in settings.
- Added Navy + NATO as the recommended initial import while leaving confronting Afghanistan audio opt-in with a warning.
- Added VAICOM source/licence attribution and automatic copying of the upstream licence beside imported audio.
- Updated cache and package versioning to 0.8.3.

## 0.8.2

- Added explicit attribution for the bundled F/A-18 Betty audio to steve-787/fa18soundmod.
- Added the upstream MIT copyright and permission notice at the project root and beside the audio library.
- Documented ThunderScope's format conversion, normalisation and filename changes.
- Updated package/cache versioning to 0.8.2.

## 0.8.1

- Bundled and normalised six user-supplied F/A-18 Betty clips as active alert overrides.
- Added a settings-page Betty cue selector and host-side preview button.
- Retained the remaining submitted clips in an inactive future-use library.
- Added an API option to preview any defined Betty alert by key.


## 0.8.0

- Added host-side random RIO / WSO radio chatter using user-supplied PCM WAV clips.
- Added generic, take-off, cruise, combat, landing and ground clip categories.
- Added broad context classification from own-aircraft telemetry.
- Added random minimum/maximum intervals, recent-clip avoidance and configurable IAS gating.
- Added a quiet period after Betty warnings and suppression while warnings remain active.
- Made safety/control cues interrupt chatter playback immediately.
- Added chatter status, folder counts and a host-side random-clip test endpoint.
- Added a dedicated settings panel and drop-in radio-pack folder structure.
- Kept ambient chatter disabled by default during migration.

## 0.8.0

- Increased flight telemetry and host-alert evaluation to 20 Hz.
- Added a persistent Windows SAPI worker to reduce TTS startup latency.
- Added zero-speed queue clearing and suppression with a 0.5 km/h jitter tolerance.
- Added low-speed sink-rate warnings below 500 km/h at -4.5 m/s by default.
- Split G alerts into a 4 G caution and an 8 G over-limit warning.
- Added stall and Mach-one alerts.
- Added debounced gear, flap-detent and airbrake transition callouts.
- Allowed decimal repeat and queue delays with a one-second minimum.
- Added custom WAV overrides for every new phrase.

## 0.7.2

- Increased flight telemetry from 4 Hz to 10 Hz.
- Added tolerant G-load field detection, a 1.25-second rolling peak window, and a 2.5-second warning latch.
- Migrated untouched positive-G thresholds from 8.5/7.5 G to 6.5 G while preserving custom values.
- Made the monitor, tablet banner, and host Betty use the same latched G warning.
- Moved map polling into an independent asynchronous loop at 10 Hz.
- Replaced repeated tablet map/telemetry GET requests with one persistent 10 Hz WebSocket stream.
- Kept a low-rate REST fallback if the tablet WebSocket disconnects.
- Reduced launcher log spam from high-frequency localhost polling.

## 0.7.0

- Added host-side Windows Betty voice alerts using offline SAPI speech.
- Added priority queueing, transition detection and configurable repeat cooldowns.
- Added voice, rate, volume and audio test controls to the settings page.
- Added optional per-alert PCM WAV overrides in the `audio` folder.
- Added host audio status to diagnostics and new `/api/audio/status` and `/api/audio/test` routes.

## 0.6.0

- Added shared profiles, settings import/export, PWA support and diagnostics.
- Added non-intrusive tablet map alerts with a quick mute control.
- Improved defensive handling for missing telemetry fields.

## 0.5.0

- Added background SQLite session recording and after-action reports.
- Added flight graphs, map paths and performance tests.

## 0.4.0

- Added automatic flight phases, energy trend, landing assistance, fuel intelligence, turn analysis and expandable engine warnings.
