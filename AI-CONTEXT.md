# Ronald Explorer — maintainer context

## Product

Static Three.js artwork with five progressively unlocked universes:

```text
RONALD → RODNEY → MARTIN → GORDON → GERALD
```

Each universe enumerates 256 six-letter names from four variable positions.
Visitors enter, build, or randomly generate names; entities persist for the
page session. The transition name in each universe triggers a confirmation and
unlocks the next. Unlocked layers remain reachable from the layer menu or by
typing their canonical names. `PROJECT.md` is the canonical product and
mathematical specification; keep this file as an implementation handover.

## Architecture

- `index.html`, `style.css`: UI shell and all styling.
- `src/main.js`: Three.js lifecycle, camera, picking, selection, inspection,
  discovery state, dialogues, and universe switching.
- `src/universes.js`: authoritative schemas, builders, enumeration, vector
  recipes, and colour functions.
- `src/RonaldPath.js`: RONALD/RODNEY paths, MARTIN orbits, and GERALD crowns.
- `src/GordonObject.js`: generated crystal geometry, materials, animation, and
  picking.
- `src/GeraldSynth.js`: Web Audio voices and attention levels.
- `src/RonaldInput.js`: typed/build/random carousel and transition routing.
- `src/RonaldSpace.js`: axes, labels, and possibility nodes.
- `src/RonaldHistory.js`: active-universe discovery list.
- `src/constants.js`: shared geometry, schemas, themes, and audio constants.

There is no bundler, package manifest, backend, persistence, or automated test
suite. Three.js 0.160 and addons load from jsDelivr through the import map.

## Runtime model

`UNIVERSES` in `src/universes.js` is the source of truth. A definition provides
its schema, all names, prefix/name validation, builder behaviour, vectors,
theme, geometry recipe, colour function, and optional transition.

`main.js` keeps one entity array across universes. Switching hides and locks
the old layer, restores the target layer, swaps theme/vectors/input/history,
and stops or starts GERALD visibility. Counts and clear/reveal actions are
per-universe. Duplicate submissions select the existing entity.

Selection rules: click selects/toggles, Shift-click adds/removes, blank click
clears, and double-click or a discovery-list click inspects. Inspection fits
the camera and shows a contextual exit button. Space toggles camera orbit.

GERALD audio must begin from a user gesture. Hover, selection, and inspection
map to increasing scrutiny; selection enables audio and leaving the universe
stops it. Crown cycles are 3/5/7/9 and slot four controls low-pass sweep, not
distortion.

MARTIN orbits are centred on the origin. A 9-unit average radius uses a
seven-second period; larger average radii revolve faster, within a restrained
0.65–1.5× range. Name-derived phases keep the population visually out of sync.
Each label stays at one fixed minor-axis extremum in the orbital plane, aligned
to travel, and only reverses its facing in place. Inspection views the complete
orbit face-on.

## Invariants and pitfalls

- Generated schemas and active positions differ: RONALD and GERALD use
  positions 1/3/5/6; RODNEY, MARTIN, and GORDON use 1/3/4/6.
- Progressive builder rules intentionally conceal the next universe. Preserve
  the normalisers and conditional controls when changing schemas.
- Preserve `focusWithinEntryStage()`, focus with `preventScroll`,
  `entryStage.scrollLeft = 0`, and the CSS clipping behaviour; together they
  prevent the carousel from skipping Build.
- Picking is throttled to animation frames. GORDON additionally uses projected
  geometry-aware fallback picking because transmissive crystals overlap.
- Keep inactive entities unpickable. MARTIN may retain a faint last trail, but
  interaction remains active-layer-only.
- Keep animation idle paths cheap. GERALD buffers should update only while live
  or shivering; device pixel ratio is capped at 2.
- Preserve unrelated uncommitted changes.

## Development and verification

Run from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Use `?test=gordon` to open GORDON with every active universe unlocked.
`?test=gerald` opens that target with its required route. MARCUS is shelved
from the visitor flow and remains available only through explicit
`?test=marcus` development access.
Manually test all three entry modes, transition routes and cancellation, duplicates,
reveal/clear, hover, click/Shift-click/double-click, discovery-list inspection,
camera navigation/orbit, switching among unlocked layers, resize, one entity
versus 256 entities, and GERALD audio start/stop.

The repository root is canonical. `scripts/deploy.sh` copies it to the remote
`www/`; container and proxy details live in `deploy/README.md`.
