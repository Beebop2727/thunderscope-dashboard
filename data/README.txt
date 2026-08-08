ThunderScope stores generated settings, navigation plans, LAN credentials and flight reports in this folder.
Keep this folder when upgrading to retain aircraft profiles, active routes and recorded sessions.

Generated files include:
- settings.json — dashboard, audio and aircraft-profile settings
- navigation.json — the current map route
- thunderscope.db — recorded flight sessions

None of those generated files should be committed to Git. settings.example.json is the clean reference template.
