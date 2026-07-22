# Ronald Explorer

## Concept

Ronald Explorer is an interactive 3D visualisation of a constrained naming space.

A valid Ronald is a six-letter name following the Ronald structure. The name is converted into a sequence of four consonant coordinates:

R O N A L D
→ R N L D

Each consonant corresponds to a vertex of a tetrahedral coordinate system.

The resulting path through the tetrahedral space represents the identity of that Ronald.

The goal is not to display text in 3D, but to visualise the hidden geometry behind names.

## Discoverable nameverse parameter matrices

The four consonants at positions 1, 3, 4, and 6 are the active parameters in
each six-letter name. They also provide the tetrahedral name-vector used for
placement; the tables below describe the additional visual meaning assigned to
each slot.

### GORDONverse — sequential crystalloid growth

GORDONs grow through four stages from a unit tetrahedron, as though a gem is
being cut. The first letter sets only the seed diameter. Later operations use a
shared manipulation scale, so a large seed does not make every later feature
larger as well.

| Slot | Meaning | G | R | D | N |
| --- | --- | --- | --- | --- | --- |
| 1 | Seed diameter | 1.40 | 1.56 | 1.72 | 1.88 |
| 2 | Axial profile | Neutral tetrahedron | Moderate prismatic extrusion / shoulder (1.85 aspect; −0.28 diameter adjustment) | Elongated point | Shallow triangular tip chamfer |
| 3 | Counter-form | Pointed bipyramidal shard, reflected across the outward face | Small counter-tetra, ratio 0.33 | Medium counter-tetra, ratio 0.67 | Full counter-tetra, ratio 1.00 |
| 4 | Rotational faceting | None | 3-fold, 120° | 4-fold, 90° | Interleaved six-pass crown, 60° |

The stages are applied in order: seed, axial profile, counter-form, then
rotational faceting. A third-position G retains the original G tip and reflects
it through the profile's outward triangular face, producing a pointed
bipyramidal shard rather than a flat terminal plate. The R prism reaches 1.05
manipulation-scale units along the axis and narrows its far diameter to 0.72×,
keeping it distinct without overwhelming the shared scale. The N rotational
pass alternates full and 0.72× radial sectors: it keeps a sixfold facet rhythm
while introducing a readable threefold crown rather than making a uniformly
repeated six-sided shell.

The GORDON tetrahedral vectors are:

| G | R | D | N |
| --- | --- | --- | --- |
| (-1, +1, -1) | (+1, +1, +1) | (+1, -1, -1) | (-1, -1, +1) |

### MARTINverse — orbital mechanics

MARTINs use the same four active slots, but their result is a coloured object
processing around a fixed orbit rather than a growing solid.

| Slot | Meaning | M | R | T | N |
| --- | --- | --- | --- | --- | --- |
| 1 | Anchor / endpoint contribution | M vector | R vector | T vector | N vector |
| 2 | Orbit shape (semi-minor ÷ semi-major) | Circle, 1.00 | Mild ellipse, 0.88 | Ellipse, 0.70 | Strong ellipse, 0.52 |
| 3 | Inclination plane X | 0° | 60° | 120° | 180° |
| 4 | Inclination plane Y | 0° | 60° | 120° | 180° |

The orbital endpoint is the sum of the four name-vectors. Its length sets the
semi-major axis, hence the orbital diameter is `2 × endpoint length`. If the
sum is the origin, MARTIN uses a canonical radius of 9 scene units and the
first-letter vector supplies the radial direction. The orbit is always
clockwise and takes 7 seconds per revolution. The initial phase is deliberately
name-derived:

`phase = (slot1 × 64 + slot2 × 16 + slot3 × 4 + slot4) / 256`

This keeps the 256 possible MARTINs visually out of sync without changing the
shared orbital speed.

The MARTIN tetrahedral vectors are:

| M | R | T | N |
| --- | --- | --- | --- |
| (-1, +1, -1) | (+1, +1, +1) | (+1, -1, -1) | (-1, -1, +1) |

### GERALDverse — waveform crowns and tone

Every GERALD is a complete, unbroken waveform crown: a readable resting
recipe bent into a circular ring with an integer number of spatial cycles. The
ring rotates slowly and silently around its wheel axis at every attention level;
rotation is deliberately independent of the audio animation.

The four active consonants control both geometry and sound:

| Slot | Visual meaning | G | R | L | D |
| --- | --- | --- | --- | --- | --- |
| 1 | Wheel axis | (−1,+1,−1) | (+1,+1,+1) | (−1,−1,+1) | (+1,−1,−1) |
| 2 | Positive axial displacement / recipe waveform | +2.4 / sine | +7.2 / sawtooth | +12 / square | +16.8 / triangle |
| 3 | Radius / harmonic count | 1.5 / 0 | 4.1 / 1 | 6.7 / 2 | 9.3 / 3 |
| 4 | Spatial cycles / distortion drive | 3 / 0 | 4 / 18 | 5 / 58 | 6 / 140 |

The resting ring is the frozen recipe: one base waveform, its axis and positive
displacement, its sleeve radius, and its integer cycle count. The waveform
deflection is always parallel to the Letter-axis, never radial.

The active ring is the actual audio wave. It advances at the selected
minor-seventh frequency and combines the oscillator with up to three harmonics
using gains `[1, 0.68, 0.48, 0.34]`, then applies the same tanh distortion
curve as the Web Audio voice. Its visual axial amplitude is intentionally
compressed to keep fast square/saw waves legible without changing the sound.

A complete reveal reads as four spaced concentric sleeves along each of the
four pre-existing Letter-axes. Inspection turns the camera perpendicular to
the wheel axis and fills roughly 70% of the screen. The front becomes a clear
2D projection; the rear half remains visible as a quieter depth cue rather than
obscuring the front.

GERALDs use a restrained pure-blue palette from near-black through blue to
white on a rich sky-blue field (`#1B4D8F`).

GERALD attention states:

| State | Visual | Audio |
| --- | --- | --- |
| No attention | Entropy-muted recipe ring; slow silent spin | Silent |
| Mouseover | Saturated colour; actual wave animates rapidly | Quiet |
| Click | Brief amplified Vib-Ribbon-style shiver, then live wave | Medium |
| Double-click / history click | Axis-facing inspection with rear-depth fade | Maximum |

Hover remains latched while the pointer stays inside the ring's projected
bounded area, preventing rapid live motion from escaping mouse focus. Shift-click
adds or removes entities from a multi-selection; clicking blank space clears
the active selection, and clicking the same selected entity again deselects it.
There is no separate oscilloscope panel: the GERALD crown is the oscilloscope.

---

## Current visual language

The scene should feel like an explorable mathematical space.

Style:
- muted grey background
- ProFont Nerd Font
- no glow effects
- restrained colours
- elegant/minimal rather than game-like

The possibility space should appear as:
- subtle grey nodes
- no permanent grid
- no large bounding geometry unless enabled

---

## Ronald paths

A Ronald path should:
- grow smoothly from the centre
- not appear as four discrete segments
- be curved/smoothed optionally
- have no endpoint marker
- display the name along the vector
- become more saturated as the identity emerges

The selected Ronald should:
- remain highlighted while the user pans and zooms
- be significantly thicker than other paths
- eventually support saturation highlighting rather than white

---

## Interaction goals

The application should support:

1. Typed Ronald generation
- user types a valid Ronald
- path grows into existence
- letters appear progressively

2. Random Ronald generation
- button cycles through candidate Ronalds
- previews several possibilities
- settles on one

3. Exploration
- click interior nodes, not only surface points
- select any possible Ronald state
- maintain selection while navigating

4. Generation exploration (optional mode)
- show families:
  - RO____
  - RON___
  - RONAL_
  - RONALD

This should complement, not replace, the empty possibility-space mode.

---

## Deployment

The canonical frontend source is the repository root (`index.html`,
`style.css`, `src/`, and `fonts/`). The server-ready static copy lives in
`ronald/www/` and is kept in sync before publication. The `ronald/` directory
also contains the read-only NGINX container configuration used to serve that
copy.

## Future settings

Settings overlay should be semi-transparent over the scene.

Possible controls:
- background colour
- line thickness
- path smoothing
- show bounding lines
- separate paths
- selected Ronald saturation
- Ronald entropy rate

---

## Technical principles

Prefer:
- modular code
- maintainable classes
- Three.js native solutions
- performance over brute force

Avoid:
- generating every Ronald permanently
- unnecessary animation loops
- visual clutter

The long-term goal is a navigable universe of possible Ronalds.

Future universes currently held as names only: **MARCUSverse** and
**FERGUSverse**. Their geometry and parameter matrices remain TBC.
