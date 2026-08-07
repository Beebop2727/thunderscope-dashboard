ThunderScope custom Betty WAV overrides
=======================================

ThunderScope uses a matching WAV whenever "Prefer custom WAV clips" is enabled.
All active cue IDs in v0.10.1 have a bundled PCM WAV override:

Fuel
  fuel-critical.wav       Warning. Low fuel.
  fuel-reserve.wav        Bingo fuel.
  joker-fuel.wav          Joker fuel.

Flight envelope
  g-limit.wav             Over G.
  g-caution.wav           G warning.
  high-aoa.wav            AoA.
  stall.wav               Stall. Stall.
  sink-rate.wav           Sink rate.
  dont-sink.wav           Don't sink.
  positive-rate.wav       Positive rate.
  hard-landing.wav        Hard landing.
  overspeed.wav           Overspeed.
  mach-one.wav            Mach one.
  energy-low.wav          Energy low.

Aircraft and engine
  engine-temperature.wav  Engine temperature.
  oil-pressure.wav        Oil pressure.
  engine-failure.wav      Engine failure.
  engine-mismatch.wav     Engine warning.
  gear-speed.wav          Gear overspeed.
  flap-speed.wav          Flap overspeed.
  check-gear.wav          Check gear.
  check-flaps.wav         Check flaps.
  check-afterburner.wav   Check afterburner.
  speedbrake.wav          Speedbrake.

Connection
  telemetry-stale.wav     Telemetry lost.
  telemetry-restored.wav  Telemetry restored.

Configuration callouts
  gear-down.wav
  gear-up.wav
  flaps-down.wav
  flaps-up.wav
  flaps-combat.wav
  flaps-takeoff.wav
  flaps-landing.wav
  airbrake-extended.wav
  airbrake-retracted.wav

The clips play through the default audio output of the PC running app.py.
Use Settings -> Preview Betty cue to test each cue without launching the game.

RIO / WSO radio chatter
=======================
Ambient radio clips belong under audio/radio rather than in this folder.
See audio/radio/README.txt for the category layout and playback rules.

Source attribution
==================
All active v0.10.1 Betty recordings were supplied by the project user.
See USER_BETTY_PACK_NOTICE.txt.

The earlier Steve-787 F/A-18 pack remains preserved only in the inactive
`audio/library/fa18-betty-pack` reference library. See THIRD_PARTY_NOTICES.md.

VAICOM radio-net chatter
========================
This build bundles 2,269 external radio-net clips under `audio/radio/vaicom`.
They remain separate from internal crew phase clips.

Source: https://github.com/Penecruz/VAICOM-Community
Licence: MIT License, Copyright (c) 2023 Penecruz
