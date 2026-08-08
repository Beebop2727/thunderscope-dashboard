# ThunderScope v0.13.1 — TGP / A-G tablet controls

The tablet calls ThunderScope over the LAN; ThunderScope emits one configured Windows keyboard action per touch. v0.13.1 uses scan-code `SendInput` and supports key chords.

## Default bindings

| Tablet control | Keyboard chord | Suggested War Thunder function |
| --- | --- | --- |
| TGP VIEW | CTRL+ALT+1 | Targeting optics / targeting pod view |
| STAB | CTRL+ALT+2 | Sight stabilization |
| A/G LOCK | CTRL+ALT+3 | Weapon lock (air-to-ground) |
| LASER | CTRL+ALT+4 | Toggle laser designator |
| SET SPI | CTRL+ALT+5 | Activate target point |
| CLR SPI | CTRL+ALT+6 | Deactivate target point |
| NEXT WPN | CTRL+ALT+7 | Switch secondary weapons |
| FIRE | CTRL+ALT+8 | Fire secondary weapon |
| ZOOM + | CTRL+ALT+9 | Targeting optics zoom increase |
| ZOOM - | CTRL+ALT+0 | Targeting optics zoom decrease |

## Binding

1. Start ThunderScope and open `/map` on the tablet.
2. Tap **TGP**.
3. In War Thunder Controls, put the desired function into key-assignment mode.
4. Tap the matching tablet button.
5. Repeat for the remaining controls.

## Diagnostic if War Thunder registers nothing

1. In ThunderScope Settings, temporarily set **TGP VIEW** to `K`.
2. Save settings.
3. Focus Windows Notepad.
4. Tap **TGP VIEW** on the tablet.
5. If `k` appears, ThunderScope is injecting input and War Thunder is filtering/not capturing it. If nothing appears, the Windows input bridge is still the problem.
6. Restore the binding after the test.

`ZOOM +` and `ZOOM -` remain holdable. ThunderScope releases held controls on pointer cancellation, page visibility loss and shutdown.
