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

### GERALDverse — crowns and tone

Every GERALD is a seamless waveform crown: a fixed-amplitude linear wave bent
into an unbroken halo with an integer cycle count. Unselected crowns rotate
slowly and silently around their own wheel axis. Selection plucks and animates
the crown while playing it; inspection brings that same crown forward as the
oscilloscope view. Hover, selection, and inspection use successively louder
audition levels.

| Slot | Visual meaning | G | R | L | D |
| --- | --- | --- | --- | --- | --- |
| 1 | Wheel axis | Z | X | Near-Y | XYZ diagonal |
| 2 | Axial position | −7.2 | −2.4 | +2.4 | +7.2 |
| 3 | Crown radius / sleeve | 4.2 | 5.4 | 6.6 | 7.8 |
| 4 | Complete cycles | 3 | 4 | 5 | 6 |

| Slot | Audio meaning | G | R | L | D |
| --- | --- | --- | --- | --- | --- |
| 1 | Minor-7 arpeggio tone | 110 Hz | 130.81 Hz | 164.81 Hz | 196 Hz |
| 2 | Oscillator | Sine | Sawtooth | Square | Triangle |
| 3 | Added harmonics | 0 | 1 | 2 | 3 |
| 4 | Distortion / fuzz | Clean | Soft | Driven | Saturated |

The waveform deflection is parallel to the Letter-axis, not radial. A complete
reveal reads as four concentric sleeves repeated along each of the four
pre-existing Letter-axes; the widened radius and axial spacing keep those
families distinct. Inspection only changes the camera to a side-on view of the
axis and animates the same waveform geometry.

Name-derived colours are selected from deep blue, turquoise, yellow, and
orange tonal families against a rich sky-blue field.

GERALD attention states:

| State | Visual | Audio |
| --- | --- | --- |
| No attention | Entropy-muted colour; static waveform rotates slowly | Silent |
| Mouseover | Saturated colour; waveform phase animates quietly | Quiet |
| Click | Brief radial pluck, then idle spin | Medium |
| Double-click / history click | Axis-facing camera view; waveform phase animates live | Maximum |

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
