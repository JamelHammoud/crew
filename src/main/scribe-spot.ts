export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Spot {
  x: number
  y: number
}

// How far off the bottom of the screen it rests before anybody has moved it.
// Low enough to be out of the way of what is being typed in and high enough to
// clear a dock.
const LIFT = 96

// It never sits hard against an edge, so a pill dragged into a corner still
// reads as floating over the screen rather than stuck to it.
const EDGE = 8

// Where the pill stands when nobody has put it anywhere: the bottom middle of
// the screen. Worked out once when it is shown rather than every time it
// changes height, or the pill walks across the screen while it is being read.
export function restSpot(work: Box, pill: Size): Spot {
  return hold(
    {
      x: work.x + work.width / 2 - pill.width / 2,
      y: work.y + work.height - pill.height - LIFT
    },
    pill,
    work
  )
}

// A spot is only ever as good as the screen it was written down on. A monitor
// that has been unplugged since, or one that changed resolution, would leave
// the pill somewhere nobody can see it, so every spot is held inside the work
// area it is going to be drawn in.
export function hold(spot: Spot, pill: Size, work: Box): Spot {
  const right = work.x + work.width - pill.width - EDGE
  const bottom = work.y + work.height - pill.height - EDGE
  return {
    x: Math.round(Math.max(work.x + EDGE, Math.min(spot.x, right))),
    y: Math.round(Math.max(work.y + EDGE, Math.min(spot.y, bottom)))
  }
}

// Growing keeps the bottom edge where it is, so the two buttons stay under the
// pointer that is reaching for them. Anchored at the top instead, a pill that
// grows a line pushes its own check button down and out from under the finger
// already on the way to it.
export function grown(box: Box, height: number, work: Box): Spot {
  return hold(
    { x: box.x, y: box.y + box.height - height },
    { width: box.width, height },
    work
  )
}

// The point a box is judged by when it is being dragged between screens: the
// middle of it, so the pill lands on the screen it is mostly over rather than
// on whichever one its top left corner happens to have crossed into.
export function middle(box: Box): Spot {
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
}

// What was written down last time, if it is a pair of real numbers. Anything
// else is a machine that has never moved the pill, which is the rest spot.
export function spotFrom(value: unknown): Spot | null {
  const saved = value as Partial<Spot> | null
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return null
  return { x: Math.round(saved.x as number), y: Math.round(saved.y as number) }
}
