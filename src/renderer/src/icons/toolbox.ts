import { GRID } from './keylines'

// The toolbox seen straight on, and what the drawing becomes when the lid comes
// up. The case is the whole of the front plane and never moves. The lid is
// hinged along the back of the mouth, behind the drawing rather than on it, so
// opening it carries the front of the lid up and away, and every number in the
// open drawing falls out of that one turn.

const RIM = 12.75
const HALF = 9.5
const LID_RISE = 4.25
const LID_R = 2.5
const HANDLE_HALF = 3.75
const HANDLE_RISE = 8.25
const HANDLE_R = 2.75

// Three quarters of what the shut box is tall, watched from a long way off. The
// distance is the whole of how much perspective is in this: far enough that
// going back costs the lid a few percent rather than turning it into a shape of
// another kind, and that its sides come back to the rim just inside the corners
// of the case rather than halfway across it. Bring the viewer in and the drawing
// sharpens into something folded.
export const TOOLBOX_DEPTH = 8.25
export const TOOLBOX_AWAY = 80

// The lid stops where the counters do. The handle is four across the middle and
// the face of the lid four and a quarter, and the turn takes a cosine off both,
// so past this they close into bars at the size the mark is worn.
export const TOOLBOX_SWING = 24

export const TOOLBOX_CASE =
  'M2.5 12.75V17a2.5 2.5 0 0 0 2.5 2.5h14a2.5 2.5 0 0 0 2.5-2.5V12.75Z'

const round = (n: number): number => Math.round(n * 1000) / 1000

type Turned = { y: number; keeps: number }

const turning =
  (swing: number) =>
  (rise: number): Turned => {
    const turn = (swing * Math.PI) / 180
    const up = TOOLBOX_DEPTH * Math.sin(turn) + rise * Math.cos(turn)
    const back = TOOLBOX_DEPTH * Math.cos(turn) - rise * Math.sin(turn)
    const keeps = TOOLBOX_AWAY / (TOOLBOX_AWAY + TOOLBOX_DEPTH - back)
    return { y: RIM - up * keeps, keeps }
  }

const side = (half: number, point: Turned, hand: 1 | -1): string =>
  `${round(GRID / 2 + hand * half * point.keeps)} ${round(point.y)}`

// A pair of legs with a rounded head, which is the lid and the handle both. The
// corner is an arc of its own two radii rather than a circle: the turn takes
// more off the height than it takes off the width, so a round corner comes back
// as an oval one.
const arch = (half: number, radius: number, foot: Turned, bend: Turned, head: Turned): string => {
  const rx = round(half * bend.keeps - (half - radius) * head.keeps)
  const ry = round(bend.y - head.y)
  return [
    `M${side(half, foot, -1)}`,
    `L${side(half, bend, -1)}`,
    `A${rx} ${ry} 0 0 1 ${side(half - radius, head, -1)}`,
    `L${side(half - radius, head, 1)}`,
    `A${rx} ${ry} 0 0 1 ${side(half, bend, 1)}`,
    `L${side(half, foot, 1)}`
  ].join('')
}

export type ToolboxDrawing = { lid: string; handle: string; collar: string }

// What the lid rests on. The hinge is the full depth of the box behind the
// front, so it always draws in from the corners of the case, and the two short
// lines that stand on the rim are the sides of the lid coming back to it. Shut,
// they lie flat along the rim under the line already drawn there.
const HINGE_HALF = round(HALF * (TOOLBOX_AWAY / (TOOLBOX_AWAY + TOOLBOX_DEPTH)))

export const toolboxAt = (swing: number): ToolboxDrawing => {
  const turned = turning(swing)
  const mouth = turned(0)
  const lip = turned(LID_RISE)
  return {
    lid: `${arch(HALF, LID_R, mouth, turned(LID_RISE - LID_R), lip)}Z`,
    handle: arch(HANDLE_HALF, HANDLE_R, lip, turned(HANDLE_RISE - HANDLE_R), turned(HANDLE_RISE)),
    collar: [
      `M${round(GRID / 2 - HINGE_HALF)} ${RIM}`,
      `L${side(HALF, mouth, -1)}`,
      `M${round(GRID / 2 + HINGE_HALF)} ${RIM}`,
      `L${side(HALF, mouth, 1)}`
    ].join('')
  }
}

export const TOOLBOX_SHUT = toolboxAt(0)
export const TOOLBOX_OPEN = toolboxAt(TOOLBOX_SWING)
