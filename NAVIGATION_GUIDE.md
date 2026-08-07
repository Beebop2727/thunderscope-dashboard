# ThunderScope mission navigation

Open the tablet map and press **NAV** to reveal the route planner.

## Point roles

- **Waypoint:** a normal intermediate route point. Multiple waypoints are allowed.
- **Target:** the selected mission destination. Setting another target replaces the existing target.
- **Home:** the primary return airfield. Selecting a runway preserves its endpoints for approach guidance.
- **Divert:** an alternate airfield or recovery point.

## Map interaction

Choose a point role and then tap the tactical map. ThunderScope snaps to a nearby recognised objective or runway when one is within the selection radius. Tapping empty map space creates a custom point.

The route list defines the order in which points are flown. Use the up/down arrows to reorder entries, the pencil to rename one, and the × button to remove it. Selecting the main part of an entry immediately makes it the active leg.

## Navigation readout

The collapsed navigation card shows:

- bearing to the active destination
- remaining distance
- ETA and estimated clock time of arrival
- left/right heading correction
- whether distance is closing, cross-track or increasing

Ground speed is measured from movement across the tactical map and smoothed to reduce jitter. ETA is therefore based on actual progress over the map rather than IAS.

## Home and runway guidance

A selected home airfield always receives a separate direct-to-home readout. Inside 20 km, ThunderScope selects the runway direction closest to the current heading, extends its centreline on the map and reports lateral offset from that line.

This is a geometric training aid, not an actual ILS. A vertical glidepath is intentionally omitted because the localhost map does not reliably provide runway elevation.

## Persistence and map changes

The route is stored locally by the ThunderScope server in `data/navigation.json`, so browser refreshes and another tablet connected to the same dashboard can see the same plan. A new War Thunder map generation automatically clears the old coordinates to prevent a route from appearing on the wrong battlefield.
