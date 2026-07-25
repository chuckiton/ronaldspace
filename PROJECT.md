# Ronald Explorer — product specification

## Concept

Ronald Explorer is an interactive mathematical artwork in which constrained
six-letter names become spatial entities. The tetrahedral possibility space is
the common setting; each universe interprets four variable letters as a path,
orbit, crystal recipe, or waveform voice.

The implemented visual language is minimal and non-game-like: ProFont,
restrained colour, no glow, and subtle nodes and axes. Each universe has its
own field colour and identity palette.

## Visitor journey

The initial RONALD demonstration types and submits itself. The entry carousel
then offers three modes:

- **Enter** filters input to prefixes valid in the active universe.
- **Build** exposes the variable positions and the progressive route to the
  next universe.
- **Random** animates the construction of a valid name and submits it.

Submitting a new name reveals it, ages existing entities in that universe, and
adds it to the discovery list. Submitting a duplicate selects the existing
entity. Reveal-all materialises the remaining 256 possibilities; clear-all
removes only the active universe's entities.

The discovery sequence is:

```text
RONALD --build RODNEY--> RODNEY --build MARTIN--> MARTIN
       --build GORDON--> GORDON --build GERALD--> GERALD
```

Each transition has a confirmation dialogue. Confirming unlocks and enters the
new universe, creates its canonical entity, and exposes the unlocked layers in
the layer menu. Returning to a layer restores its entities and interactions.
Inactive entities are hidden and cannot be picked. `GODNEY` opens a refusal
dialogue and does not unlock a universe.

## Shared interaction

- Hover highlights an entity and its discovery-list entry while suppressing
  other path labels.
- Click selects; clicking the sole selected entity again deselects it.
- Shift-click toggles additive multi-selection.
- Clicking empty space clears selection.
- Double-click inspects an entity with a fitted camera view. Clicking an entry
  in the discovery list also inspects it; Shift-click there multi-selects.
- The contextual exit button returns from inspection.
- OrbitControls provide rotate, pan, and zoom. Space or the orbit button
  toggles automatic camera orbit; non-GERALD inspection starts orbiting.

## Name systems

Every universe has 256 generated names: four choices in each of four active
positions.

| Universe | Schema | Active positions | Form |
| --- | --- | --- | --- |
| RONALD | `[RNLD]O[RNLD]A[RNLD][RNLD]` | 1, 3, 5, 6 | Curved path from the origin through cumulative letter vectors |
| RODNEY | `[RNDY]O[RNDY][RNDY]E[RNDY]` | 1, 3, 4, 6 | Path beginning at an outer vertex and stepping inward/toward vertices |
| MARTIN | `[MRTN]A[MRTN][MRTN]I[MRTN]` | 1, 3, 4, 6 | Closed elliptical orbit and moving trail |
| GORDON | `[GRDN]O[GRDN][GRDN]O[GRDN]` | 1, 3, 4, 6 | Sequentially constructed crystal |
| GERALD | `[GRLD]E[GRLD]A[GRLD][GRLD]` | 1, 3, 5, 6 | Closed waveform crown and synthesizer voice |

Coordinate scale is 3. The tetrahedral assignments are:

| Universe | Letter vectors |
| --- | --- |
| RONALD | R `(1,1,1)`, N `(-1,-1,1)`, L `(-1,1,-1)`, D `(1,-1,-1)` |
| RODNEY | R `(1,1,1)`, N `(-1,-1,1)`, Y `(-1,1,-1)`, D `(1,-1,-1)` |
| MARTIN | M `(-1,1,-1)`, R `(1,1,1)`, T `(1,-1,-1)`, N `(-1,-1,1)` |
| GORDON | G `(-1,1,-1)`, R `(1,1,1)`, D `(1,-1,-1)`, N `(-1,-1,1)` |
| GERALD | G `(-1,1,-1)`, R `(1,1,1)`, L `(-1,-1,1)`, D `(1,-1,-1)` |

### RONALD and RODNEY

RONALD uses active letters 1, 3, 5, and 6 as cumulative moves from the origin.
The resulting five control points form a smooth tube path. RODNEY uses letters
1, 3, 4, and 6: it starts four coordinate steps out at the first letter's
vertex, then makes four equal moves toward the centre or the named outer
vertices. Both use lineage-derived identity colour, progressive drawing,
camera-scaled labels, selection emphasis, and entropy ageing.

### MARTIN

| Slot | M | R | T | N |
| --- | --- | --- | --- | --- |
| 1 | Anchor vector | Anchor vector | Anchor vector | Anchor vector |
| 2 | Circle 1.00 | Ellipse 0.88 | Ellipse 0.70 | Ellipse 0.52 |
| 3 | X plane 0° | X plane 60° | X plane 120° | X plane 180° |
| 4 | Y plane 0° | Y plane 60° | Y plane 120° | Y plane 180° |

The sum of the four vectors sets the semi-major axis and radial direction.
When it sums to zero, a canonical radius of 9 is used with the first vector as
the direction. MARTINs orbit clockwise once every 7 seconds. Their initial
phase is the base-four name index divided by 256, keeping the population out of
sync without varying speed.

### GORDON

GORDON applies four operations in name order:

| Slot | G | R | D | N |
| --- | --- | --- | --- | --- |
| 1: seed diameter | 1.40 | 1.56 | 1.72 | 1.88 |
| 2: axial profile | Neutral tetrahedron | Moderate tapered prism/shoulder | Elongated point | Shallow triangular tip chamfer |
| 3: counter-form | Reflected pointed bipyramidal shard | 0.33 counter-tetra | 0.67 counter-tetra | 1.00 counter-tetra |
| 4: rotational faceting | None | 3-fold / 120° | 4-fold / 90° | Interleaved 6-pass / 60° crown |

The seed diameter is independent of the shared manipulation scale used by the
later stages. The R profile extends 1.05 manipulation units and narrows to
0.72×. The N rotation alternates full and 0.72× radial sectors. GORDON uses
physical materials, studio environment lighting, ACES tone mapping, and
geometry-aware picking.

### GERALD

GERALD is a closed crown whose visual waveform and Web Audio voice share the
same four parameter indices:

| Slot | G | R | L | D |
| --- | --- | --- | --- | --- |
| 1 | Axis G / sine | Axis R / sawtooth | Axis L / square | Axis D / triangle |
| 2 | Position 2.4 / A2 110 Hz | 7.2 / C3 130.81 Hz | 12 / E3 164.81 Hz | 16.8 / G3 196 Hz |
| 3 | Radius 1.5 / 3 chorus notes | 4.1 / 2 | 6.7 / 1 | 9.3 / 0 |
| 4 | 3 cycles / 0.35 Hz filter sweep | 5 / 0.8 Hz | 7 / 1.8 Hz | 9 / 3.6 Hz |

Waveform deflection is parallel to the selected axis. Resting crowns rotate
slowly and silently. Hover animates and auditions quietly; click enables audio,
selects, and briefly shivers the crown; inspection faces the wheel axis,
fits the crown to the viewport, and uses maximum scrutiny. Multi-selection
plays multiple voices. Leaving GERALD stops them. The synth uses gains
`[1, 0.68, 0.48, 0.34]` and a low-pass cutoff oscillating around 3200 Hz with
2600 Hz depth.

## Current scope

The application is a static ES-module site with no build system, persistence,
backend, analytics, settings panel, or automated tests. Discoveries exist only
for the current page session. MARCUS and FERGUS are not implemented.

The canonical deployable frontend is `index.html`, `style.css`, `src/`, and
`fonts/`. Deployment details belong in `deploy/README.md`.
