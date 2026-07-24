# Ronald Explorer

Ronald Explorer is a browser-based Three.js artwork that maps constrained
six-letter names into paths, orbits, crystalline forms, and waveform crowns in
a shared tetrahedral space.

The application currently contains five connected universes:

- **RONALD** — curved identity paths through a tetrahedral naming space.
- **RODNEY** — the forbidden neighbouring coordinate system.
- **MARTIN** — name-derived elliptical orbits and persistent trails.
- **GORDON** — sequentially constructed crystal forms.
- **GERALD** — rotating waveform crowns coupled to Web Audio voices.

`PROJECT.md` is the canonical product and mathematical specification.
`HISTORY.md` records design decisions and superseded approaches.
`AI-CONTEXT.md` is a compact implementation handover for future maintainers.

## Run locally

This is a static ES-module application with no build step. It imports Three.js
from jsDelivr, so local development requires an internet connection and an HTTP
server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://localhost:8000`. The optional `?test=gordon` and `?test=gerald`
query strings unlock those universes and create a reference entity for visual
testing.

## Source layout

| Path | Purpose |
| --- | --- |
| `index.html`, `style.css` | Application shell and interface styling |
| `src/main.js` | Scene lifecycle, interaction, selection, and universe switching |
| `src/universes.js` | Universe definitions, validation, geometry recipes, and colour rules |
| `src/RonaldPath.js` | RONALD, RODNEY, MARTIN, and GERALD rendering |
| `src/GordonObject.js` | GORDON geometry and material implementation |
| `src/GeraldSynth.js` | GERALD Web Audio voice management |
| `src/RonaldInput.js` | Typed, builder, and random entry modes |
| `src/RonaldSpace.js` | Shared possibility nodes, axes, and labels |
| `src/RonaldHistory.js` | Discovered-entity list |
| `src/constants.js` | Shared geometry, naming, theme, and audio constants |
| `deploy/` | NGINX and Docker Compose configuration |

## Deployment

The repository contains no duplicate deployment copy. Deploy the canonical
frontend into the existing server layout with:

```sh
./scripts/deploy.sh
```

Preview the exact transfer without changing the server:

```sh
./scripts/deploy.sh --dry-run
```

Set `RONALD_DEPLOY_HOST` and `RONALD_DEPLOY_ROOT` locally before deploying.
See `deploy/README.md` for Fish setup, server layout, and the reverse-proxy
procedure.

## Performance notes

The render loop updates all discovered entities, so entity implementations
should make their idle path effectively constant-time. In particular:

- GERALD vertex buffers update only while a crown is live or shivering.
- Inactive-universe animation paths return before geometry work.
- Pointer picking is throttled to one pass per animation frame.
- Device pixel ratio is capped at 2.

When changing animation code, test both one entity and **Unveil all**. Verify
selection, hover, inspection, labels, resize behaviour, and universe switching.
