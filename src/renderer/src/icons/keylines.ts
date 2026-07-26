// The numbers every Crew icon is drawn against. A shape sits on the keyline for
// its own family rather than on one box for all of them, because a circle drawn
// the same size as a square reads smaller than it. Equal on the ruler is not
// equal to the eye, and the eye is what ships.

export const GRID = 24

// Nothing's centerline crosses this. A 1.5 stroke on it paints to 1.5 and 22.5,
// which is the closest anything comes to the edge of the box.
export const LIVE = 19.5

// The house stroke, and the size it is the right stroke at. A 24 grid worn at 16
// paints two thirds of whatever is written here, so 1.5 arrives as a single pixel
// and the whole set reads wiry. 2 arrives at 1.33 and reads the way an icon
// beside a solid one has to. Past 2.25 the counters start closing: the sun fills
// in, the terminal prompt runs into its own frame.
export const STROKE = 2
export const STROKE_BOLD = 2.5
export const WORN = 16

// How the stroke is adjusted for the size an icon is actually worn at. A small
// mark needs relatively more weight to hold its color and a large one needs
// less, so the ramp is gentle and it is a share of the drawing's own weight
// rather than a number of its own.
const WEAR: { upTo: number; of: number }[] = [
  { upTo: 14, of: 1.05 },
  { upTo: 21, of: 1 },
  { upTo: 27, of: 0.9 },
  { upTo: Infinity, of: 0.8 }
]

const WIDTH = /(?:^|\s)(?:w|size)-(?:\[(\d+(?:\.\d+)?)px\]|(\d+(?:\.\d+)?))(?:\s|$)/

export function wornAt(className: string): number {
  const found = WIDTH.exec(className)
  if (!found) return WORN
  return found[1] ? Number(found[1]) : Number(found[2]) * 4
}

export function wearWeight(weight: number, className: string): number {
  const px = wornAt(className)
  const step = WEAR.find(one => px <= one.upTo) ?? WEAR[WEAR.length - 1]
  return Math.round(weight * step.of * 100) / 100
}

// A square is the anchor. Every other keyline is derived from it, so moving this
// one number moves the whole set together.
export const SQUARE = 17

// A circle needs 8.8% more diameter than a square needs side to read the same
// size. Equal area would ask for 12.8%, which overshoots for an outlined form.
export const CIRCLE = 18.5
export const CIRCLE_R = CIRCLE / 2

// A rectangle keeps the square's area as it flattens: the long side grows by
// exactly what the short side loses, so sqrt(w * h) stays 17.
export const WIDE = { w: 19, h: 15.2 }
export const TALL = { w: 15.2, h: 19 }

// Half of a diagonal form's box is empty, so it takes the whole live area and
// still sits a little light. Pushing further only breaks the frame. Triangles,
// diamonds, the pencil, the star, the slash.
export const DIAGONAL = 19.5

// A bare run of stroke with nothing enclosed: arrow shafts, rules, the plus.
export const LINE = 15

// A filled shape carries its whole box as ink where an outlined one carries only
// its edge, so it sits under the square keyline rather than on it. Not as far
// under as equal ink would ask: a solid mark standing alone in a button is being
// read as a button rather than against its neighbours, and it has to fill it.
// An outlined square at 17 paints its stroke outside itself and arrives at 19,
// so a solid at 16 is still the lighter of the two on the page.
export const SOLID = 16

// Outer corners. A radius is read against the side it turns, so it is written
// as a share of the shorter side rather than as one number for every box.
export const RADIUS = 0.15
export const RADIUS_TIGHT = 0.1

export const corner = (side: number, share = RADIUS): number =>
  Math.round(side * share * 4) / 4

// One diagonal for every icon that is turned off, drawn at the same angle and
// the same length wherever it lands. The form underneath crosses it rather than
// breaking for it: a break has to be solved per shape against a background the
// icon cannot know, and at 16px the gap reads as a rendering fault.
export const SLASH = 'm3.9 3.9 16.2 16.2'

// A rect's x for a given width, centered. Saves counting halves in the art.
export const center = (size: number): number => Math.round((GRID - size) * 50) / 100
