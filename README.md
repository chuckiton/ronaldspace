# Ronald Explorer

Ronald Explorer is a browser-based Three.js artwork about discovering geometry
inside constrained six-letter names. It begins with RONALD paths in a shared
tetrahedral space and can unfold into four related universes:

- **RONALD** — curved paths through a possibility space.
- **RODNEY** — inward paths in a forbidden neighbouring space.
- **MARTIN** — name-derived elliptical orbits with persistent trails.
- **GORDON** — crystals assembled by four sequential operations.
- **GERALD** — rotating waveform crowns coupled to Web Audio voices.

Every universe contains 256 possible entities. Four variable letters select
tetrahedral coordinates and, where applicable, visual or sonic parameters.

## Discovery flow

The site opens in RONALD and types `RONALD` as a short demonstration. From
there, a visitor can:

1. enter a valid name, build one letter by letter, or ask for a random one;
2. submit names to reveal persistent entities in the scene and discovery list;
3. hover to identify, click to select, Shift-click to multi-select, or
   double-click (and click a discovery-list entry) to inspect;
4. drag, pan, and zoom the camera, or toggle automatic orbit with the orbit
   button or Space;
5. reveal or clear all 256 entities in the active universe.

The other universes are not exposed as ordinary navigation at first. They are
found by constructing a particular name in the current universe:

```text
RONALD → RODNEY → MARTIN → GORDON → GERALD
```

Each discovery asks for confirmation, unlocks a new layer, and preserves access
to earlier unlocked layers through the layer menu. Typing the canonical name of
an unlocked universe also returns to it. `GODNEY` is a deliberate dead end.

GERALD uses sound only after a selection gesture. Hover, selection, and
inspection progressively increase attention and volume; leaving GERALD stops
its audio.

## Run locally

This is a static ES-module application with no build step. Three.js is imported
from jsDelivr, so local use requires an internet connection and an HTTP server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. The URL-only `?test=gordon` and `?test=gerald`
harnesses unlock all layers, open the requested universe, and create one
reference entity.

## Documentation

- [`PROJECT.md`](PROJECT.md) is the canonical description of the implemented
  product, name systems, and interaction model.
- [`AI-CONTEXT.md`](AI-CONTEXT.md) is the concise technical handover for
  maintainers and coding agents.
- [`deploy/README.md`](deploy/README.md) covers deployment.

## Source layout

| Path | Purpose |
| --- | --- |
| `index.html`, `style.css` | Application shell and interface styling |
| `src/main.js` | Scene lifecycle, input actions, selection, inspection, and universe switching |
| `src/universes.js` | Universe schemas, validation, geometry recipes, and colour rules |
| `src/RonaldPath.js` | Path, orbit, and waveform-crown rendering |
| `src/GordonObject.js` | GORDON geometry and materials |
| `src/GeraldSynth.js` | GERALD Web Audio voice management |
| `src/RonaldInput.js` | Typed, builder, and random entry modes |
| `src/RonaldSpace.js` | Possibility nodes, axes, and labels |
| `src/RonaldHistory.js` | Per-universe discovery list |
| `src/constants.js` | Shared geometry, naming, theme, and audio constants |
| `deploy/`, `scripts/deploy.sh` | Container configuration and deployment script |

## Deployment

The repository root is the canonical frontend; there is no deployment copy.

```sh
./scripts/deploy.sh
./scripts/deploy.sh --dry-run
```

Set `RONALD_DEPLOY_HOST` and `RONALD_DEPLOY_ROOT` locally. See
[`deploy/README.md`](deploy/README.md) for the server layout and proxy setup.

## Verification

There is no automated test suite. After interaction or rendering changes, test
one entity and the full reveal in every affected universe. Check all three
entry modes, duplicate selection, hover, single/Shift/double-click, discovery
list inspection, camera controls, clearing, layer switching, resize behaviour,
and GERALD audio.
