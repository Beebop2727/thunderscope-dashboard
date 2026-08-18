# ThunderScope v0.13.0 validation

- `app.py`, `host_audio.py` and `input_bridge.py` compile successfully.
- `map.js` and `settings.js` pass `node --check`.
- Application starts successfully in the validation environment.
- `/map` contains the TGP / A-G drawer and `/settings` contains virtual-control configuration.
- `/api/controls/status` returns all ten configured actions.
- F13 and F22 resolve to Windows virtual-key codes `0x7C` and `0x85`.
- Non-Windows hosts correctly report the input bridge as unavailable rather than crashing.
- Input release-all is called on server shutdown; the tablet also requests release-all on browser blur/visibility loss.
- Existing navigation, carrier, Betty and VAICOM files are unchanged by this feature.
- Windows `keybd_event` execution cannot be exercised inside the Linux packaging environment and must be verified on the actual Windows War Thunder host.
