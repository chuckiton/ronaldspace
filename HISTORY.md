# Ronald Explorer — Development History

## Origin

Ronald Explorer began as an attempt to represent names as geometric objects rather than strings.

The core idea:

A Ronald is not just a sequence of letters. It is a trajectory through a constrained possibility space.

The visualisation should allow a user to explore the hidden structure of possible Ronalds.

The goal is closer to an interactive mathematical artwork than a conventional name generator.


# Core Mathematical Model

## Ronald Encoding

A valid Ronald has the structure:

R O N A L D

The vowels are structural placeholders.

The identity-bearing components are the consonants:

R N L D

These four letters form the vertices of a tetrahedral coordinate system.

The mapping is:

R = ( 1,  1,  1)
N = (-1, -1,  1)
L = (-1,  1, -1)
D = ( 1, -1, -1)

A Ronald becomes a vector path:

centre
  |
  R
  |
  RN
  |
  RNL
  |
  RNLD

The final position and trajectory encode that particular Ronald.


# Important Conceptual Decisions

## The Possibility Space Is The Main Object

The empty tetrahedral space should exist before any Ronald is generated.

The user should feel they are exploring a universe of possibilities.

A generated Ronald is an inhabitant of this space.

Do not replace this with only a tree explorer.

Generation views are an optional analytical layer over the same underlying space.


## Nodes Represent Valid States

Early versions used random point clouds.

This was rejected.

The nodes should represent actual reachable Ronald states:

- partial names
- possible consonant sequences
- convergent paths

The node structure should be generated recursively from the letter vectors.


# Visual Design Decisions

## General Style

The design language should be:

- minimal
- mathematical
- elegant
- restrained

Avoid:

- game-like interfaces
- excessive animation
- sci-fi aesthetics
- unnecessary visual effects


## Background

Preferred:

Muted grey background.

Rejected:

- pure black
- pure white


## Typography

Use:

ProFont Nerd Font

for interface text and labels.

Canvas-generated text must explicitly load and use the font.


## No Glow

Glow effects were specifically rejected.

Visual hierarchy should come from:

- line thickness
- colour
- saturation
- opacity

not bloom or lighting effects.


# Ronald Path Behaviour

A Ronald path should feel like an entity emerging.

Desired behaviour:

- begins at the centre
- grows smoothly
- does not appear as four discrete segments
- has no endpoint marker
- can use adjustable smoothing
- remains explorable after creation


# Colour System

Two colour systems are desired.


## Path-Derived Colour

A Ronald begins white at the origin.

As the path grows:

centre:
white

then:

subtle tint

then:

fully saturated identity colour

The colour represents identity emerging.

Circular or convergent paths should retain narrative meaning.


## Intrinsic Coordinate Colour

A second optional colour system can derive colour from the four-dimensional coordinate representation.

This gives each Ronald an intrinsic colour signature.

Both systems should coexist:

Path-derived colour:
developmental history.

Coordinate-derived colour:
identity.


# Selection Behaviour

A selected Ronald should:

- remain highlighted
- persist while camera movement occurs
- become much thicker than normal paths
- become more saturated

The user should be able to pan and zoom around a selected Ronald without losing it.


# Interaction Goals

## Initial State

On loading:

Show the base case:

RONALD

as a demonstration.

The interface should invite exploration.


## Typed Ronalds

The user should be able to type a Ronald.

Letters should appear progressively:

R

RO

RON

RONA

RONAL

RONALD

Do not show placeholders such as:

R O _ _ _ _

The input box should have a flashing underscore cursor.


## Generate Ronald

Button label:

Generate Ronald

Avoid technical terminology such as "instantiate".

Behaviour:

1. Generate candidate Ronalds.
2. Animate candidate paths.
3. Cycle through possibilities.
4. Settle on a selected Ronald.


# Generation Explorer

This is optional functionality.

It should not replace the open possibility-space mode.

Example:

Generation 1:

R
N
L
D

Generation 2:

RO__
RN__
RL__
RD__

Generation 3:

RON_
ROL_
ROR_
...

Generation 4:

RONALD

Purpose:

Show families and relationships between Ronalds.


# Settings

Settings should open as a semi-transparent overlay.

Not as a separate page.

Possible controls:

- background colour
- line thickness
- path smoothing
- separate paths
- show bounding lines
- selected Ronald saturation
- Ronald entropy rate


# Ageing / Entropy

Ronalds should eventually have an ageing system.

Older Ronalds:

- fade
- lose saturation
- become less prominent

Setting:

Ronald entropy rate

New Ronalds should appear visually fresh.

Selected Ronalds should resist ageing.


# Current Technical Direction

Built with:

- Three.js
- ES modules
- OrbitControls

Current architecture should move towards:

src/

main.js

RonaldSpace.js
- tetrahedral coordinate system
- possibility nodes

RonaldPath.js
- path generation
- animation
- colour

RonaldGenerator.js
- random generation

Selection.js
- picking/highlighting

Settings.js
- overlay controls


Avoid keeping all functionality in one file.


# Future Ideas

Potential future developments:

- click any interior node to interrogate possible Ronalds
- animate transitions between related Ronalds
- compare two Ronald paths simultaneously
- show divergence between similar Ronalds
- generate colour spaces from four-coordinate values
- export Ronald trajectories
- explore other six-letter structures


# Current Priority Order

1. Stable thick animated Ronald path.
2. Progressive text along path.
3. Typed Ronald input.
4. Selection and persistence.
5. Random Ronald generator.
6. Generation explorer.
7. Entropy system.
8. Advanced colour models.