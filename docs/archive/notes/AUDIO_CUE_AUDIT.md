# ThunderScope v0.10.3 audio cue audit

## Uploaded Bitchin' Betty 2 pack

All 34 supplied recordings are integrated and mapped:

| Cue ID | Spoken cue | Detection |
|---|---|---|
| `fuel-critical` | Warning, low fuel | Fuel below critical profile percentage |
| `fuel-reserve` | Bingo fuel | Fuel below reserve profile percentage |
| `joker-fuel` | Joker fuel | Fuel below early warning percentage |
| `g-caution` | G warning | Rolling positive-G peak above caution threshold |
| `g-limit` | Over G | Positive or negative G beyond profile limit |
| `high-aoa` | AoA | AoA above profile threshold |
| `stall` | Stall, stall | Exported stall flag or fallback AoA threshold |
| `sink-rate` | Sink rate | Low-speed descent beyond profile limit |
| `dont-sink` | Don't sink | Descent shortly after a detected take-off |
| `positive-rate` | Positive rate | Sustained climb after accelerating from stationary |
| `hard-landing` | Hard landing | Conservative landing-phase sink/deceleration estimate |
| `overspeed` | Overspeed | IAS above aircraft-profile limit; disabled by default |
| `mach-one` | Mach one | Hysteretic subsonic-to-supersonic transition |
| `energy-low` | Energy low | High-G, low-speed, rapid deceleration; disabled by default |
| `engine-temperature` | Engine temperature | Oil/water/head temperature above profile limit |
| `oil-pressure` | Oil pressure | Large drop from learned in-flight pressure baseline |
| `engine-failure` | Engine failure | Large RPM collapse with throttle still applied |
| `engine-mismatch` | Engine warning | Multi-engine RPM asymmetry |
| `flap-speed` | Flap overspeed | Flaps deployed above profile limit |
| `check-gear` | Check gear | Landing-flap approach without gear down |
| `check-flaps` | Check flaps | Gear-down approach with flaps retracted |
| `check-afterburner` | Check afterburner | Afterburner/WEP active at or below Bingo fuel |
| `speedbrake` | Speedbrake | Airbrake extended while high throttle is applied |
| `telemetry-stale` | Telemetry lost | Port 8111 feed missing after an active flight |
| `telemetry-restored` | Telemetry restored | Feed reconnects after a stale-telemetry warning |
| `gear-down` | Gear down | Debounced gear transition |
| `gear-up` | Gear up | Debounced gear transition |
| `flaps-down` | Flaps down | Generic deployed flap state |
| `flaps-up` | Flaps up | Fully retracted flap state |
| `flaps-combat` | Combat flaps | Low flap deployment range |
| `flaps-takeoff` | Take-off flaps | Medium flap deployment range |
| `flaps-landing` | Landing flaps | High flap deployment range |
| `airbrake-extended` | Airbrake extended | Debounced airbrake transition |
| `airbrake-retracted` | Airbrake retracted | Debounced airbrake transition |

## Complete active cue coverage

`gear-speed.wav` now uses the additional matching Betty recording supplied by
the project user. Every currently active cue therefore has a custom WAV from the
same user-generated voice set.

## Optional future recordings

These are not required by v0.10.3 and do not yet have active rules:

- `fuel-pressure.wav` — Fuel pressure
- `propeller-overspeed.wav` — Prop overspeed
- `radiator.wav` — Check radiator
- `approach-speed.wav` — Check speed
- `bank-angle.wav` — Bank angle
- `negative-g.wav` — Negative G
- `unload.wav` — Unload
- `return-to-base.wav` — Return to base
- `afterburner.wav` / `afterburner-off.wav`
- `touchdown.wav`
- `objective-complete.wav` / `objective-failed.wav` / `mission-complete.wav`

Several require aircraft-specific limits or telemetry validation before they can
be enabled without nuisance or misleading warnings.
