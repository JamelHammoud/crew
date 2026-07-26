---
name: crew-icons
description: Draw an icon for Crew, or change one. Use whenever a new glyph is needed, an existing one is being reworked, or a Heroicon is being replaced. Holds the grid, the keylines, the stroke, the naming, and how to check the result.
---

# Drawing an icon for Crew

Crew draws its own icons. They live in `src/renderer/src/icons`, one file per
family, and `glyph()` in `src/renderer/src/components/glyph.tsx` puts the frame
around every one of them. Never hand-roll an `<svg>` element.

The look is: outlined, geometric but soft, plump rather than skinny, and never
more than three marks. It should look like it was drawn by someone who liked the
thing they were drawing.

## The frame

24 grid. 1.5 stroke. Round caps, round joins. `fill="none"`, `currentColor`.
`glyph()` sets all of it, so the art is only the shapes.

Fill is for meaning, not for weight. The three dots of an ellipsis are filled
because a 1.5 ring at that size closes up into a smudge. Nothing else fills.

## The keylines

This is the whole reason the set looks like one size. A circle drawn the same
size as a square reads smaller, so shapes do not share one box: each family sits
on its own number, and the numbers are chosen so the families read equal.

| family | keyline | notes |
| --- | --- | --- |
| square | 17 | the anchor. every other number comes from it |
| circle | 18.5 | 8.8% more diameter than the square's side |
| wide rect | 19 × 15.2 | any rect keeps sqrt(w · h) = 17 |
| tall rect | 15.2 × 19 | same rule, turned over |
| diagonal | 19.5 | triangles, diamonds, the pencil, the slash |
| line | 15 | a bare run of stroke: a plus, a chevron, an arrow shaft |

The live area is 19.5, from 2.25 to 21.75. Nothing's centreline crosses it.

Two things follow from this that are easy to get wrong:

- **A rect is judged on the geometric mean of its box, not its longest side.**
  Widen a shape and it has to flatten by the same share, or it grows.
- **Long sides cap at 19.** A document is taller than the keyline wants and there
  is nowhere left to put the height, so it takes the cap and sits a few percent
  light. Breaking the frame is worse. The same goes for a triangle: half its box
  is empty, so it takes the full 19.5 and is still light. Accept it.

Round the art to a quarter unit. Half units for straight edges. Do not chase
pixel alignment, a 24 grid drawn at 16 lands nowhere near whole pixels and
nobody's set solves that.

## What makes them Crew's

- **Two or three marks.** Cuteness dies in detail. A clipboard with ruled lines
  on it is a worse clipboard.
- **Generous radii.** About 15% of the shorter side. On a 17 square that is 2.5.
- **Reuse the body.** A photo, a window and a terminal are the same 19 × 15 screen
  with different insides, held in one constant. Three shapes that nearly agree is
  the thing to avoid.
- **One moment of character** where the idea allows it: the pupil in the eye, the
  eyes and mouth on the smile, the little tab on the clipboard.
- **Turn every corner.** A sharp point beside a rounded set reads as a different
  family, so even the warning triangle has its corners turned at 1.5.
- **A negated icon crosses, it does not break, and it keeps every mark it had.**
  One `SLASH`, the same angle and length wherever it lands, over the whole form.
  Breaking the shape underneath has to be solved per shape against a background
  the icon cannot know, and at 16px the gap reads as a rendering fault. Dropping
  a mark to make room for the slash is the other way to get it wrong: the icon
  changes size and position the moment it is turned off, in the row it was just
  drawn in. `SpeakerOff` is the whole speaker plus the slash for exactly that
  reason, waves and all.

## Naming

`<Thing>Glyph`, exported from the file for its family, re-exported by
`src/renderer/src/icons/index.ts`. One drawing per idea. Before adding one, check
whether the idea is already drawn: `Duplicate` is also copy, `Window` is also a
browser page. The test fails on two names holding the same art.

## Checking it

```
yarn icons
```

Draws every icon onto `icon-sheet.html` at 48 with its keylines and at 24, 20 and
16 as it is really worn, and prints what is off. Open it. The set is the one
thing that cannot be reviewed a file at a time.

Under each card:

- **size** the box against the keyline for its family. Over 8% is a problem
  unless the icon is capped.
- **ink** stroke length against the median of its own family. A chevron will
  never carry a square's ink and is not asked to. This flags an icon that is
  fussy or bare compared to its neighbours.
- **centre** how far the art's centre sits from the centre of the box. Over 0.5
  and it reads low or off to one side in every row it stands in.

```
yarn test tests/icons.test.ts
```

Holds all of it: inside the live area, centred, on the keyline, drawn in
`currentColor` on the house frame, and never the same drawing twice.

The family is worked out from the art rather than declared: a run that comes back
near where it started encloses something and is measured on its box, one that
does not is a line and is measured on how far it reaches. It is right nearly
always and it is a flag, not a verdict. If it has a shape in the wrong family,
look at the icon before changing the tool.

## Drawing one

1. Decide the family and write down the keyline before drawing anything.
2. Draw it against that number. Reuse a constant if the body already exists.
3. `yarn icons`, read the three numbers, look at the 16px column.
4. `yarn test tests/icons.test.ts`.

Arcs are where this goes wrong. A sweep flag the wrong way round makes a shape
that is still valid SVG and still lands near its keyline. Look at it.

## Still on Heroicons

The app has not been switched over yet. `src/renderer/src/icons` is complete and
covers every Heroicon in use; the call sites still import from `@heroicons/react`.
Three older sets are on the 24 grid but not on these keylines, and `yarn icons`
lists what is off in each:

- `src/renderer/src/components/toolGlyphs.tsx`, what an agent did
- `src/renderer/src/components/doc/docGlyphs.tsx`, doc blocks, at a 2 stroke
- `src/renderer/src/design/glyphs.tsx`, the canvas

Their circles are at 17 where the keyline is 18.5, which is the drift the
keylines exist to stop. Fold them into `src/renderer/src/icons` when the swap
happens rather than adding a fourth set.
