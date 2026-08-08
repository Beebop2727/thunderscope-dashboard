# ThunderScope synthetic carrier landing guide

## Purpose

ThunderScope v0.12.0 adds a generic, external carrier-approach trainer to the
existing tactical map. It does not modify War Thunder or inject controls. All
steering and voice guidance is derived from the browser map, the manually marked
deck and the aircraft telemetry available through the local dashboard.

## Marking the carrier

1. Open the tablet map and press **NAV**.
2. Expand **Carrier landing aid**.
3. Press **Mark stern + bow**.
4. Tap the stern end of the landing deck.
5. Tap the bow end of the same landing deck.

The stern-to-bow vector becomes the landing course. ThunderScope draws the deck in
green, a touchdown reference in yellow and a dashed final approach line behind the
stern. A deck shorter than roughly 25 metres at the current map scale is rejected.

For a moving carrier, the first version does not automatically attach the marks to
the ship object. Repeat the marking process when the carrier has moved far enough
for the old line to become inaccurate.

## Vertical setup

Enter the approximate **deck altitude** using the same map datum as War Thunder's
reported aircraft altitude. The synthetic glidepath is calculated from the touchdown
point, deck altitude and selected glidepath angle. The default is 3.5 degrees.

The displayed vertical error means:

- positive value: aircraft is above the selected glidepath;
- negative value: aircraft is below the selected glidepath;
- unavailable: War Thunder is not currently reporting usable aircraft altitude.

## Aircraft profile

Use **Load aircraft profile** to copy the active aircraft's carrier settings into the
planner. The profile contains:

- minimum and maximum approach IAS;
- target AoA and allowed tolerance;
- maximum final bank;
- maximum acceptable sink rate;
- selected glidepath angle.

The global and per-aircraft values are edited on `/settings`. Generic defaults are
intentionally broad and should be tuned during test flights.

## Synthetic LSO display

Inside the configured approach range, while generally aligned with the landing
course, the map displays:

- high/low glidepath indication and vertical error;
- left/right centreline indication and lateral error;
- distance to the touchdown reference and deck heading;
- IAS and AoA;
- vertical speed and bank;
- gear and flap state;
- a two-axis guidance ball;
- a wave-off banner with the measured reason when the close-in approach is unsafe.

The ball moves horizontally with centreline error and vertically with glidepath
error. It is a generic visual training aid and does not reproduce a particular
Fresnel lens optical landing system.

## Spoken callouts

LSO callouts use the host's TTS system. They have separate enable, voice, rate and
volume controls under Settings. Available calls include:

- approaching final and distance milestones;
- check gear/check flaps;
- high, low and slightly high/low;
- come left/come right;
- fast/slow and AoA high/low;
- ease bank, check sink rate and power;
- approaching the ramp;
- wave off;
- likely arrested, bolter and good pass.

Callouts have client and server cooldowns so the LSO does not repeat continuously.
Normal VAICOM chatter remains on its independent channel.

## Wave-off logic

Close to the deck, a conservative wave-off may be issued for one or more of:

- gear not down;
- flaps not set;
- sink rate beyond the configured limit;
- substantially below glidepath;
- large centreline error;
- excessive bank;
- large heading error;
- extreme speed outside the aircraft profile.

This is deliberately conservative. It is intended to teach stable approaches, not
to prove whether a marginal landing could physically succeed.

## Pass outcomes and grades

The result is inferred rather than read directly from the game:

- **LIKELY ARRESTED:** the aircraft crosses the touchdown reference and rapidly
  settles near deck altitude at low ground speed;
- **BOLTER:** the aircraft crosses the deck and continues beyond it at flying speed,
  climbing or remaining airborne;
- **DECK CROSSING:** the deck is crossed but the available data does not support a
  stronger conclusion;
- **WAVE-OFF:** a commanded unsafe approach is abandoned before touchdown.

The optional score starts at 100 and deducts for centreline error, glidepath error,
sink rate, IAS, AoA, bank and incorrect configuration. Treat the result as a training
metric, not as a replacement for the game's own landing model.

## Recommended first test

Use a test flight and a stationary or slow-moving carrier. Set the deck altitude,
leave the 3.5-degree glidepath selected, enter a broad IAS window for the aircraft,
and make several passes. Adjust only one parameter between passes so the effect is
clear. The carrier setup and last grade persist in `data/navigation.json` until the
map changes or the configuration is cleared.
