import { HELD_MAX, HELD_WIDTH, PILL_MAX, PILL_REST, PILL_ROOM, PILL_WIDTH } from '../shared/scribe'

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

// The window is the pill plus the room its shadow lands in, and it follows what
// the pill really is: the pill is on screen the whole time dictation is on, and
// Electron passes no click through a transparent window on either platform, so
// every pixel of window past the pill is a click of somebody else's that goes
// nowhere.
//
// The smallest it may be is the pill at rest, the largest is the card a dictation
// with nowhere to land is held on. Both ends are held here rather than trusted,
// because the size comes off a page measuring itself and a window of nought or of
// the whole screen is worse than a window of the wrong size.
//
// The largest is worked out from both of the things that can stand in this window
// rather than from whichever is bigger today, so a failure's sentence and a card
// of held words each get their own room and neither has to know about the other.
export const PILL_SMALLEST = {
  width: PILL_REST + PILL_ROOM * 2,
  height: PILL_REST + PILL_ROOM * 2
}

export const PILL_LARGEST = {
  width: Math.max(PILL_WIDTH, HELD_WIDTH) + PILL_ROOM * 2,
  height: Math.max(PILL_MAX, HELD_MAX) + PILL_ROOM * 2
}

export function fits(size: Size): Size {
  return {
    width: Math.round(Math.max(PILL_SMALLEST.width, Math.min(size.width, PILL_LARGEST.width))),
    height: Math.round(Math.max(PILL_SMALLEST.height, Math.min(size.height, PILL_LARGEST.height)))
  }
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

// Growing keeps the bottom edge where it is, so what is on the pill stays under
// the pointer that is reaching for it. Anchored at the top instead, a pill that
// grows a line pushes its own buttons down and out from under the finger already
// on the way to them.
//
// Sideways it keeps its middle, because that is where it grows from: the pill is
// as small as the mark while nothing is being said and opens out around itself
// the moment there is, so held by an edge instead it would walk across the screen
// every time somebody started talking.
export function grown(box: Box, size: Size, work: Box): Spot {
  return hold(
    {
      x: box.x + box.width / 2 - size.width / 2,
      y: box.y + box.height - size.height
    },
    size,
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
