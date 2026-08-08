# Repository and release layout

ThunderScope uses two practical distribution styles:

## Source / Lite

The Git repository should contain the application, the 35 Betty warning clips,
and the VAICOM importer scripts, but not the 2,269-file VAICOM chatter library.
After cloning, run the importer for the current operating system or copy an
existing `audio/radio/vaicom` directory into the project.

## Full release

The downloadable full ZIP contains the VAICOM library for convenience. The
library remains ignored by Git, so extracting a full release inside a working
copy does not add thousands of audio files to the next commit.

Generated settings, navigation plans and session databases live in
`data/` and are ignored. Keep `data/README.txt` and `data/settings.example.json`
as documentation/templates only.
