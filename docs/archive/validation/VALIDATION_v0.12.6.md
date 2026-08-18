# ThunderScope v0.12.6 Validation

## Scope

Heading-vector overlay and player-centred camera behaviour.

## Checks

- JavaScript syntax checked with Node.
- Python sources compile successfully.
- Map HTML contains the new `VEC` toggle.
- Service-worker cache identifier bumped to v0.12.6.
- Default follow camera uses the exact screen centre even when the aircraft is on a tactical-map boundary.
- Manual pan still offsets the camera and Reset (`◎`) returns the aircraft to centre.
- Heading vector is a solid magenta line beginning just beyond the aircraft nose and extending beyond the viewport edge.
- Vector orientation combines aircraft direction and map rotation, so it follows the displayed nose in both heading-up and north-up modes.
- Existing navigation, carrier, zoom/pan, alert and radio functionality retained.
