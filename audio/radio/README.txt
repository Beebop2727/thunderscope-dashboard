ThunderScope internal crew and external radio-net chatter
=========================================

Put uncompressed PCM WAV files into one of these folders. File names can be
anything; ThunderScope discovers them automatically while it is running.

  generic\   Safe ambient/intercom chatter usable during any flight phase
  takeoff\   Departure, checks, climb-out and formation departure clips
  cruise\    Navigation, systems checks and quiet transit chatter
  combat\    High-workload or manoeuvring chatter that does not claim a target
  landing\   Approach, pattern, carrier/field recovery and landing checks
  ground\    Taxi or runway chatter (only used when ground chatter is allowed)

Recommended clip rules
----------------------
- Use PCM WAV, ideally 44.1 or 48 kHz, 16-bit mono or stereo.
- Keep clips short (roughly 1-8 seconds) and normalise their loudness first.
- Do not use clips that falsely claim a missile launch, radar contact, target
  lock, weapon release or damage unless ThunderScope actually has that event.
- Only use audio you have permission to use, especially for public releases.

Behaviour
---------
- Chatter is off by default until enabled under /settings.
- The configured interval is randomised between the minimum and maximum.
- Context-aware mode prefers the current flight-phase folder, then generic.
- Recent clips are avoided to reduce repetition.
- VAICOM chatter and Betty/LSO warnings use independent playback channels.
- Chatter continues underneath warnings by default; this can be disabled in Settings.
- Chatter is produced by the Windows or Linux computer running ThunderScope, not the tablet.


VAICOM Community integration
-----------------------------
Full release ZIPs include the VAICOM library. Source/lite installs can run
import_vaicom_chatter.bat, import_vaicom_chatter.sh, or the Python importer.
VAICOM themes are stored under:
  vaicom\Navy\*.wav
  vaicom\NATO\*.wav
  ...

These files are external AWACS/carrier/range/network radio traffic. They are
not presented as direct RIO/WSO dialogue. Choose the source and theme under
/settings.
