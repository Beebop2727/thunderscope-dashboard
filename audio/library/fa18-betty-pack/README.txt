F/A-18 Betty pack bundled with ThunderScope
===========================================

Source project:
  F/A-18 Betty: RWR and Voice Pack by steve-787
  https://github.com/steve-787/fa18soundmod

Licence:
  MIT License — Copyright (c) 2025 steve-787
  See LICENSE-fa18soundmod.txt in this folder and THIRD_PARTY_NOTICES.md at the
  ThunderScope project root.

ThunderScope modifications
==========================
All clips in this folder were converted to mono 44.1 kHz, 16-bit PCM WAV and
normalised for more consistent playback. This folder is a future-use library;
files here do not play automatically.

Active ThunderScope mappings copied into the parent audio folder:

  BingoFuel/bingo fuel .wav        -> fuel-reserve.wav
  OverG/OverG.wav                  -> g-limit.wav
  HUDStallWarning/StallWarning.wav -> stall.wav
  EngineFailure/f18_engine.wav     -> engine-mismatch.wav
  Warning/f18_caution.wav          -> g-caution.wav
  LandingGear/check gear.wav       -> gear-speed.wav

The following source sounds remain inactive because ThunderScope cannot yet
verify those events from port 8111, or because a safe trigger has not been
implemented: missile launch/RWR, fire, left/right engine fire, hydraulics,
generator failure, shoot, collision-close, altitude and pull-up.
