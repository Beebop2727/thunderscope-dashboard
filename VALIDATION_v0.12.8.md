# ThunderScope v0.12.8 validation

- Removed the `audioop` dependency introduced in v0.12.7.
- Radio gain and cockpit-radio filtering now use only Python standard-library primitives that remain available on Python 3.13/3.14.
- Python syntax validation passed for `app.py` and `host_audio.py`.
- JavaScript syntax validation passed for `static/js/settings.js`.
- Processed an 8-bit mono VAICOM WAV successfully while preserving duration/sample rate.
- Processed a 16-bit mono Betty WAV successfully while preserving duration/sample rate.
- Radio gain boost, cockpit-radio processing, independent chatter channel, Betty alerts, navigation, carrier aid, map centring, and heading vector remain intact.
