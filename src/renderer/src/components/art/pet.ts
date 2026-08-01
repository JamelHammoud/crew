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
    return `M ${coords.map(c => c.join(' ')).join(' L ')} Z`
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

// The one number a cursor takes off a pet. A cursor has to be one legible color
// rather than a picture, so it reads the hue the pet was seeded with even though
// nothing about the mark is painted in it any more.
export function petHue(seed: string): number {
  return petOf(seed).hue
}
