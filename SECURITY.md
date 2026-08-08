# ThunderScope LAN security

`run_local` binds only to `127.0.0.1`.

`run_lan` binds to `0.0.0.0:8765` so a tablet or another device on the same local
network can open ThunderScope directly. v0.12.4 does not use a
shared token, cookie or application-level authentication.

Use LAN mode only on a trusted home/private network. On Windows, prefer a firewall
rule scoped to your trusted network profile when practical. Do not port-forward
8765 to the public Internet. For remote access, use a private VPN rather than
exposing ThunderScope directly.


## Virtual cockpit input bridge

v0.13.1 can emit configured Windows keyboard keys when a trusted LAN client presses the tablet TGP controls. This project intentionally uses simple LAN access without authentication at the user's request, so only run the LAN launcher on networks you trust. The bridge is deliberately limited to one configured key per touch action and does not inject into the War Thunder process or read game memory.
