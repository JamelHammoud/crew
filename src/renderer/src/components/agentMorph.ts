import { eyeSize, petPath, type Pet } from './art/pet'
import type { AgentActivity } from './agentActivity'

export const AGENT_MORPH_MS = 820

export interface MorphDrawing {
  body: string
  features: readonly [string, string, string]
}

const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx} ${cy - ry} C${cx + rx} ${cy - ry} ${cx + rx} ${cy + ry} ${cx} ${cy + ry} C${cx - rx} ${cy + ry} ${cx - rx} ${cy - ry} ${cx} ${cy - ry} Z`

const capsule = (x: number, y: number, width: number, height: number): string => {
  const radius = height / 2
  const right = x + width
  const bottom = y + height
  return `M${x + radius} ${y} H${right - radius} C${right} ${y} ${right} ${bottom} ${right - radius} ${bottom} H${x + radius} C${x} ${bottom} ${x} ${y} ${x + radius} ${y} Z`
}

const tiny = (x: number, y: number): string => ellipse(x, y, 0.15, 0.15)

const drawings: Record<Exclude<AgentActivity, 'idle'>, MorphDrawing> = {
  thinking: {
    body: 'M50 18 C58 18 64 22 68 29 C76 26 84 29 88 36 C92 43 90 51 85 57 C88 66 82 75 73 78 C66 84 56 83 50 79 C43 84 33 84 27 78 C18 76 12 67 15 58 C9 52 9 42 14 35 C19 28 27 27 34 30 C37 23 43 18 50 18 Z',
    features: [ellipse(31, 49, 6.5, 6.5), ellipse(50, 49, 6.5, 6.5), ellipse(69, 49, 6.5, 6.5)]
  },
  reading: {
    body: 'M50 34 C39 24 25 21 11 26 C7 27 5 31 5 35 V77 C5 82 9 85 14 83 C28 78 40 80 50 88 C60 80 72 78 86 83 C91 85 95 82 95 77 V35 C95 31 93 27 89 26 C75 21 61 24 50 34 Z',
    features: [capsule(20, 45, 24, 5), capsule(56, 45, 24, 5), capsule(48.5, 36, 3, 48)]
  },
  searching: {
    body: 'M43 8 C62 8 75 22 75 40 C75 47 73 53 69 59 L95 84 C100 89 99 95 94 98 C90 101 85 99 81 95 L56 70 C52 72 48 73 43 73 C24 73 11 59 11 40 C11 22 24 8 43 8 Z',
    features: [ellipse(43, 40, 20, 20), tiny(65, 62), tiny(69, 66)]
  },
  editing: {
    body: 'M35 7 H65 C83 7 92 16 92 34 V66 C92 84 83 93 65 93 H35 C17 93 8 84 8 66 V34 C8 16 17 7 35 7 Z',
    features: [capsule(25, 28, 43, 8), capsule(25, 47, 56, 8), capsule(25, 66, 37, 8)]
  },
  designing: {
    body: 'M66 5 C73 1 82 4 86 11 C89 16 88 22 85 27 L61 60 C62 64 63 68 62 73 C60 84 48 92 25 97 C17 99 12 92 16 85 C20 78 16 72 18 64 C19 58 24 54 31 51 C34 50 37 50 40 51 L66 5 Z',
    features: [tiny(48, 58), tiny(51, 61), tiny(54, 64)]
  },
  running: {
    body: 'M26 17 H74 C88 17 96 25 96 39 V61 C96 75 88 83 74 83 H26 C12 83 4 75 4 61 V39 C4 25 12 17 26 17 Z',
    features: [capsule(23, 46, 24, 8), capsule(51, 58, 21, 8), tiny(75, 62)]
  },
  planning: {
    body: 'M18 8 H82 C90 8 95 13 95 21 C95 28 91 32 85 33 C92 34 95 39 95 51 C95 58 91 62 85 63 C92 64 95 69 95 80 C95 88 90 93 82 93 H18 C10 93 5 88 5 80 C5 72 9 68 15 67 C8 65 5 60 5 51 C5 43 9 39 15 37 C8 35 5 30 5 21 C5 13 10 8 18 8 Z',
    features: [capsule(18, 17, 60, 6), capsule(18, 47, 54, 6), capsule(18, 77, 64, 6)]
  },
  communicating: {
    body: 'M17 13 H83 C92 13 97 20 97 29 V55 C97 64 90 71 81 71 H54 L32 87 C27 91 21 86 24 80 L28 71 H17 C8 71 3 64 3 55 V29 C3 20 8 13 17 13 Z',
    features: [ellipse(31, 42, 6, 6), ellipse(50, 42, 6, 6), ellipse(69, 42, 6, 6)]
  },
  acting: {
    body: 'M50 2 L58 11 L69 8 L73 20 L84 20 L83 32 L94 38 L87 49 L94 60 L83 67 L84 79 L72 79 L68 91 L57 88 L50 98 L42 89 L31 92 L27 80 L16 80 L17 68 L6 62 L13 51 L6 40 L17 33 L16 21 L28 21 L32 9 L43 12 Z',
    features: [ellipse(50, 50, 14, 14), tiny(36, 50), tiny(64, 50)]
  }
}

function idleDrawing(pet: Pet): MorphDrawing {
  const size = eyeSize(pet)
  const left = pet.eyeX - pet.eyeGap / 2
  const right = pet.eyeX + pet.eyeGap / 2
  return {
    body: petPath(pet),
    features: [
      capsule(left - size.width / 2, pet.eyeY - size.height / 2, size.width, size.height),
      capsule(right - size.width / 2, pet.eyeY - size.height / 2, size.width, size.height),
      tiny(pet.eyeX, pet.eyeY)
    ]
  }
}

export function morphDrawing(activity: AgentActivity, pet: Pet): MorphDrawing {
  return activity === 'idle' ? idleDrawing(pet) : drawings[activity]
}
