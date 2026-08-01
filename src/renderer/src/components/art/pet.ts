// The pet an agent wears, before anything is drawn: a body and two eyes, worked
// out from the agent's id. It is kept apart from the drawing the way a cover's
// scene is, so it can be read without a canvas in the room and drawn on a sheet
// beside every other one.

function prng(seed: string): () => number {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), hash | 1)
    hash ^= hash + Math.imul(hash ^ (hash >>> 7), hash | 61)
    return ((hash ^ (hash >>> 14)) >>> 0) / 4294967296
  }
}

export const EYE_RADIUS = 4.5

// The box the body and the eyes are laid out on, the way a glyph is drawn on 24.
export const PET_GRID = 100

export interface Pet {
  hue: number
  body: string
  eyeY: number
  eyeGap: number
  tilt: number
}

// How far back along each edge a corner is cut before it is turned, on the 100
// box. Nothing a pet is made of comes to a point: the angular family is there so
// that not every one of them is a blob, and it keeps its flat sides and its
// count either way. A corner is what the stroke's round join was already trying
// to do at 3.5 and could not be seen doing at the size a pet is worn.
const CORNER = 9

// A polygon turned at every vertex. The cut is held under a share of the shorter
// of the two edges meeting there, or a corner standing on a short edge reaches
// past the middle of it and the two cuts cross, which folds the outline inside
// out.
const turned = (coords: Array<[number, number]>): string => {
  const count = coords.length
  const along = (from: [number, number], to: [number, number], by: number): [number, number] => {
    const run = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
    const step = Math.min(by, run * 0.42) / run
    return [from[0] + (to[0] - from[0]) * step, from[1] + (to[1] - from[1]) * step]
  }
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const here = coords[i]
    const back = along(here, coords[(i + count - 1) % count], CORNER)
    const on = along(here, coords[(i + 1) % count], CORNER)
    parts.push(`${i === 0 ? 'M' : 'L'} ${back.join(' ')} Q ${here.join(' ')} ${on.join(' ')}`)
  }
  return `${parts.join(' ')} Z`
}

function blobPath(rand: () => number, straight: boolean): string {
  const points = straight ? 5 + Math.floor(rand() * 3) : 8
  const jitter = straight ? 8 : 11
  const coords: Array<[number, number]> = []
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2
    const radius = 30 + (rand() - 0.5) * 2 * jitter
    coords.push([50 + Math.cos(angle) * radius, 54 + Math.sin(angle) * radius * 0.92])
  }
  const cx = coords.reduce((sum, c) => sum + c[0], 0) / points
  const cy = coords.reduce((sum, c) => sum + c[1], 0) / points
  for (const c of coords) {
    c[0] += 50 - cx
    c[1] += 53 - cy
  }
  if (straight) {
    return turned(coords)
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let path = `M ${mid(coords[points - 1], coords[0]).join(' ')}`
  for (let i = 0; i < points; i++) {
    const next = coords[(i + 1) % points]
    path += ` Q ${coords[i].join(' ')} ${mid(coords[i], next).join(' ')}`
  }
  return path + ' Z'
}

// The numbers come off one stream in the order they are read here, so nothing
// about this may be reordered: a pet is the same pet on everyone's screen and on
// the day after a change, and reading the stream another way is a different one.
function makePet(seed: string): Pet {
  const rand = prng(seed)
  const pet = {
    hue: Math.floor(rand() * 360),
    body: blobPath(rand, rand() < 0.3),
    eyeY: 48 + rand() * 8,
    eyeGap: 11 + rand() * 7
  }
  rand()
  return { ...pet, tilt: (rand() - 0.5) * 14 }
}

const pets = new Map<string, Pet>()

export function petOf(seed: string): Pet {
  let pet = pets.get(seed)
  if (!pet) {
    pet = makePet(seed)
    pets.set(seed, pet)
  }
  return pet
}

// How much of the tile the pet takes. It is a drawing decision rather than
// something the seed answers, so it is applied to the shape rather than built
// into it: the pet is the pet, and this is how much room the picture behind it
// gets. Drawn at its own size the body fills the circle and what is left of the
// field is a rim, which is a white shape on a colored ring rather than a shape
// standing on a photograph.
export const BODY = 0.78

// The least that may stand between the two eye holes, in real pixels at the size
// the pet is drawn. Two holes that close up are one slot, and a slot across the
// middle of a white shape is not a face: at 20 across, which is what a pet is
// worn at in a mention menu, the narrowest pair a seed hands out leaves under
// half a pixel between them and they merge.
export const MIN_BRIDGE = 1.2

// So the gap is opened at draw time rather than seeded wider. Equal on the ruler
// is not equal to the eye, which is the same reason a circle is not 17 on the
// keylines and the shadow is a share of the box: the pet is one pet at every
// size, and what changes is what the size can hold. Seeding it wider instead
// would redraw everybody's face for the sake of the smallest one it is worn at.
export function eyeGapAt(pet: Pet, box: number): number {
  return Math.max(pet.eyeGap, EYE_RADIUS * 2 + (MIN_BRIDGE * PET_GRID) / (box * BODY))
}

// The one number a cursor takes off a pet. A cursor has to be one legible color
// rather than a picture, so it reads the hue the pet was seeded with even though
// nothing about the mark is painted in it any more.
export function petHue(seed: string): number {
  return petOf(seed).hue
}
