# Changelog

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
