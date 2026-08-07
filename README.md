# ThunderScope v0.10.3

ThunderScope is a local War Thunder telemetry, tactical-map, host-audio and
flight-analysis dashboard. It reads the game's port `8111` and provides a
heading-up tablet map plus a separate secondary-monitor data display.

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

Open the tablet map using the host's LAN address:

```text
http://HOST-LAN-IP:8765/map
```

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

The complete chatter library is now bundled under:

```text
audio/radio/vaicom/
```

Open Settings, enable **Ambient radio chatter**, choose **VAICOM radio net** or
**Mixed crew + radio net**, and select a theme. Recommended first choices are
**Navy** and **NATO**. By default, Betty warnings play over chatter without stopping the transmission.

The Afghanistan theme contains real-world combat communications and may be
confronting. It is included because it was present in the user-supplied archive,
but it is never selected automatically.

The import scripts remain available for refreshing or replacing themes from a
newer local VAICOM repository or ZIP later.

## Running away from the game PC

By default ThunderScope reads `http://127.0.0.1:8111`. A separate host can be
specified with:

```bash
WT_BASE_URL=http://WAR-THUNDER-PC-IP:8111 ./run_lan.sh
```

This requires the game PC to permit LAN access to port 8111.

## Existing features

- Heading-up tablet tactical map with smooth 10 Hz follow and unobtrusive alerts
- Adaptive flight dashboard and landing assistance
- Host Betty alerts with per-cue WAV overrides
- Cross-platform Windows/Linux audio playback
- Phase-aware internal crew chatter plus 2,269 bundled VAICOM theme clips
- Background session recording and after-action reports
- Aircraft-specific thresholds and settings import/export

## Upgrade

Extract v0.10.3 over the existing folder while retaining:

```text
data/settings.json
data/thunderscope.db
```

Existing settings migrate automatically. Clear the tablet kiosk browser cache
once because the service-worker version changed.
