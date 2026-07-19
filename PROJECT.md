# Ronald Explorer

## Concept

Ronald Explorer is an interactive 3D visualisation of a constrained naming space.

A valid Ronald is a six-letter name following the Ronald structure. The name is converted into a sequence of four consonant coordinates:

R O N A L D
→ R N L D

Each consonant corresponds to a vertex of a tetrahedral coordinate system.

The resulting path through the tetrahedral space represents the identity of that Ronald.

The goal is not to display text in 3D, but to visualise the hidden geometry behind names.

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