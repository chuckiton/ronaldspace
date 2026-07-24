# Ronaldverse Explorer — Agent Handover

## What this is

An interactive Three.js artwork for the 256 valid `RONALD`-form names: `[RNLD]O[RNLD]A[RNLD][RNLD]`. The identity-bearing letters map to tetrahedral vectors (`R`, `N`, `L`, `D`); each name is a curved path from the origin through that space. Read `PROJECT.md` and `HISTORY.md` for the design rationale and mathematical model.

## Current product state

- Light default theme: `#EBEBEB` background, dark paths/UI; a dark-mode toggle is present.
- ProFont is the interface and canvas typeface.
- The initial `RONALD` demo types, pauses briefly, then submits automatically.
- Paths persist after later submissions, age toward beige entropy in 10% steps, and appear in **Ronalds discovered**. Duplicates select/highlight the existing path and do not increment the count.
- Entry carousel has exactly three modes: **Enter a Ronald**, **Build new Ronald**, **Random Ronald**.
  - Typed input accepts only the valid positional schema.
  - Build supports pointer and arrow-key editing.
  - Random visually composes a valid Ronald before submitting.
  - Typed, built, and random duplicate candidates use the existing Ronald’s identity colour.
- Path labels lie along the final path segment, maintain camera-relative size, fade in after drawing, and are hidden for non-hovered paths while a path is hovered.
- **Unveil all Ronalds** adds every remaining Ronald.

## Current parameter matrices

The canonical, fuller explanation lives in `PROJECT.md`; this is the compact
implementation reference for the discoverable solids and orbits. In every
six-letter name, the active consonants are positions 1, 3, 4, and 6.

### GORDON

| Slot | G | R | D | N |
| --- | --- | --- | --- | --- |
| 1 seed diameter | 1.40 | 1.56 | 1.72 | 1.88 |
| 2 axial profile | Neutral tetrahedron | Moderate prism / shoulder (1.85 aspect; −0.28 diameter adjustment) | Elongated point | Tip chamfer |
| 3 counter-form | Pointed bipyramidal shard / outward-face reflection | 0.33 counter ratio | 0.67 counter ratio | 1.00 counter ratio |
| 4 rotation | 0 passes | 120° / 3-fold | 90° / 4-fold | 60° interleaved crown |

Growth is sequential. Third-position G retains the original G tip and reflects
it through the profile's outward triangular face, producing a pointed
bipyramidal shard. The R prism extends 1.05 manipulation-scale units and
narrows its far diameter to 0.72×. The N rotation alternates full and 0.72×
radial sectors, retaining sixfold faceting while adding a threefold crown.

### MARTIN

| Slot | M | R | T | N |
| --- | --- | --- | --- | --- |
| 1 anchor | M vector | R vector | T vector | N vector |
| 2 shape ratio | 1.00 circle | 0.88 ellipse | 0.70 ellipse | 0.52 ellipse |
| 3 plane X | 0° | 60° | 120° | 180° |
| 4 plane Y | 0° | 60° | 120° | 180° |

MARTIN orbital diameter comes from twice the length of the summed name-vector;
the clockwise period is fixed at 7 seconds. Initial phase uses the base-4
parameter index `(p1 × 64 + p2 × 16 + p3 × 4 + p4) / 256`.

## Important implementation details

### GERALD

GERALD is a seamless waveform crown and four-parameter Web Audio synthesizer.
Slots `[0, 2, 4, 5]` select minor-7 arpeggio tone, waveform, added harmonics,
and distortion. The crown uses the same slots for wheel axis, direct axial
position lookup, radius, and integer cycle count. The waveform deflection is
parallel to the wheel axis, with four widened radius sleeves repeated along
each pre-existing Letter-axis. Its crown is the oscilloscope: there is no separate canvas panel. Hover, click, and double-click increase
audition volume; selection plucks the crown; inspection fills the view. Audio
starts only from a GERALD selection gesture and stops on leaving the universe.
Shift-click toggles additive multi-selection in every universe.
Inspection keeps the true waveform geometry, turns the camera perpendicular to
the rotation axis, and animates that same crown as a live oscilloscopic view.
Attention states are: idle entropy-muted silent spin; mouseover saturated quiet
wave animation; click brief pluck at medium volume; and double-click/history
click axis-facing examination at maximum volume.

- Main files: `src/main.js`, `src/RonaldInput.js`, `src/RonaldPath.js`, `src/RonaldSpace.js`, `src/RonaldHistory.js`, and `src/constants.js`.
- The root `index.html`, `style.css`, `src/`, and `fonts/` are canonical; there
  is no committed deployment copy. Use `./scripts/deploy.sh` to populate the
  server's existing `www/` directory.
- Bump the cache query in `index.html` and the `RonaldInput.js` query in `src/main.js` whenever client assets need forced refresh.
- The carousel previously skipped Build because focusing it auto-scrolled `#ronald-entry-stage` while CSS also translated the track. Do not remove `focusWithinEntryStage()`, `preventScroll`, `scrollLeft = 0`, or `overflow: clip` without retesting all mode transitions.

## Deployment

- Server layout is selected locally through `RONALD_DEPLOY_ROOT`, containing
  `www/`, `docker-compose.yaml`, and `nginx.conf`.
- `deploy/docker-compose.yaml` runs `nginxinc/nginx-unprivileged:1.28-alpine` on host port **8888** (container port 8080). Nginx Proxy Manager terminates public TLS and proxies HTTP to port 8888.
- The site is bind-mounted read-only; the container is non-root, read-only, capability-dropped, and resource-limited where the host supports it.
- Deploy from the current workspace with:

  ```sh
  ./scripts/deploy.sh
  ```

  The restart is optional for static bind-mounted files, but is a reliable final step. Keep port 8888 restricted to the proxy/Docker network.

## Repository status

- Git repository exists on `main`; remote is `https://github.com/chuckiton/ronaldspace.git`.
- Base commit: `c824b20 Initial Ronald Space explorer`.
- The remote push was previously blocked by unavailable GitHub authentication; authenticate before pushing.
- Preserve existing uncommitted work. Do not reset or discard changes merely to clean the tree.

## Working approach

Maintain the restrained, mathematical visual language: no glow, no game-like UI, no gratuitous 3D text. Prefer modular Three.js code and performance-conscious updates. Verify interaction changes, especially drawing, pan/zoom, labels, overlapping paths, and the entry carousel.
