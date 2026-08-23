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

export const PET_GRID = 100
export const EYE_WIDTH = 12
export const EYE_HEIGHT = 26
export const MIN_EYE_GAP = 1.2
export const FIELD_LIGHT = 1

export const PET_SHAPE_KINDS = [
  'circle',
  'teardrop',
  'square',
  'egg',
  'capsule',
  'triangle',
  'pentagon',
  'hexagon',
  'tall-hexagon',
  'octagon',
  'decagon',
  'bean'
] as const

const PET_SHAPE_STREAM: readonly PetShapeKind[] = [
  'circle',
  'teardrop',
  'circle',
  'square',
  'egg',
  'capsule',
  'triangle',
  'pentagon',
  'hexagon',
  'tall-hexagon',
  'octagon',
  'decagon',
  'bean'
]

export type PetShapeKind = (typeof PET_SHAPE_KINDS)[number]

export interface Pet {
  hue: number
  kind: PetShapeKind
  body: string
  variant: number
  eyeX: number
  eyeY: number
  eyeGap: number
  tilt: number
}

interface EyeRoom {
  left: number
  right: number
  top: number
  bottom: number
}

const EYE_ROOMS: Record<PetShapeKind, EyeRoom> = {
  circle: { left: 18, right: 82, top: 15, bottom: 70 },
  teardrop: { left: 24, right: 79, top: 21, bottom: 68 },
  square: { left: 16, right: 84, top: 14, bottom: 72 },
  egg: { left: 21, right: 79, top: 16, bottom: 70 },
  capsule: { left: 14, right: 86, top: 28, bottom: 72 },
  triangle: { left: 29, right: 71, top: 30, bottom: 70 },
  pentagon: { left: 25, right: 75, top: 27, bottom: 70 },
  hexagon: { left: 21, right: 79, top: 22, bottom: 71 },
  'tall-hexagon': { left: 26, right: 74, top: 24, bottom: 70 },
  octagon: { left: 20, right: 80, top: 20, bottom: 72 },
  decagon: { left: 19, right: 81, top: 19, bottom: 72 },
  bean: { left: 23, right: 79, top: 23, bottom: 70 }
}

const EYE_SCALES: Record<PetShapeKind, number> = {
  circle: 1,
  teardrop: 0.92,
  square: 1,
  egg: 1,
  capsule: 0.82,
  triangle: 0.78,
  pentagon: 0.85,
  hexagon: 0.92,
  'tall-hexagon': 0.82,
  octagon: 1,
  decagon: 1,
  bean: 0.92
}

export interface EyeSize {
  width: number
  height: number
  radius: number
}

export function eyeSize(pet: Pick<Pet, 'kind'>): EyeSize {
  const scale = EYE_SCALES[pet.kind]
  const width = EYE_WIDTH * scale
  return { width, height: EYE_HEIGHT * scale, radius: width / 2 }
}

const eyeExtents = (size: EyeSize, tilt: number): { x: number; y: number } => {
  const angle = (Math.abs(tilt) * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return {
    x: (size.width / 2) * cosine + (size.height / 2) * sine,
    y: (size.width / 2) * sine + (size.height / 2) * cosine
  }
}

const rounded = (value: number): number => Math.round(value * 1000) / 1000

type Point = [number, number]

const toward = (from: Point, to: Point, distance: number): Point => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
  const step = Math.min(distance, length * 0.32) / length
  return [from[0] + (to[0] - from[0]) * step, from[1] + (to[1] - from[1]) * step]
}

function roundedPolygon(
  sides: number,
  box: number,
  rotation: number,
  radiusX: number,
  radiusY: number,
  corner: number
): string {
  const unit = box / PET_GRID
  const points: Point[] = Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index / sides) * Math.PI * 2
    return [(50 + Math.cos(angle) * radiusX) * unit, (51 + Math.sin(angle) * radiusY) * unit]
  })
  const parts: string[] = []
  for (let index = 0; index < sides; index++) {
    const here = points[index]
    const before = toward(here, points[(index + sides - 1) % sides], corner * unit)
    const after = toward(here, points[(index + 1) % sides], corner * unit)
    parts.push(
      `${index === 0 ? 'M' : 'L'} ${before.map(rounded).join(' ')} Q ${here.map(rounded).join(' ')} ${after.map(rounded).join(' ')}`
    )
  }
  return `${parts.join(' ')} Z`
}

function bodyFor(kind: PetShapeKind, variant: number, box: number): string {
  const unit = box / PET_GRID
  const at = (value: number): number => rounded(value * unit)
  const v = variant * 3
  if (kind === 'circle') {
    const center = at(50)
    const radius = at(43)
    return `M ${center} ${at(7)} a ${radius} ${radius} 0 1 1 0 ${at(86)} a ${radius} ${radius} 0 1 1 0 ${at(-86)} Z`
  }
  if (kind === 'teardrop') {
    return `M ${at(46)} ${at(10)} C ${at(48)} ${at(7)} ${at(52)} ${at(7)} ${at(54)} ${at(10)} C ${at(62 + v)} ${at(22)} ${at(84)} ${at(38 - v)} ${at(87)} ${at(56)} C ${at(90)} ${at(76)} ${at(74)} ${at(91)} ${at(51)} ${at(92)} C ${at(28)} ${at(93)} ${at(11)} ${at(77)} ${at(14)} ${at(56)} C ${at(17)} ${at(38)} ${at(38 - v)} ${at(22)} ${at(46)} ${at(10)} Z`
  }
  if (kind === 'square') {
    return `M ${at(28)} ${at(9 + v)} C ${at(16)} ${at(10)} ${at(10)} ${at(17)} ${at(9)} ${at(29)} L ${at(8)} ${at(71)} C ${at(8)} ${at(84)} ${at(16)} ${at(91)} ${at(29)} ${at(92)} L ${at(72)} ${at(91 - v)} C ${at(85)} ${at(91)} ${at(92)} ${at(83)} ${at(92)} ${at(70)} L ${at(91)} ${at(28)} C ${at(91)} ${at(15)} ${at(83)} ${at(8)} ${at(70)} ${at(8)} Z`
  }
  if (kind === 'egg') {
    return `M ${at(50)} ${at(7)} C ${at(68 + v)} ${at(7)} ${at(80)} ${at(28)} ${at(85)} ${at(52)} C ${at(90)} ${at(76)} ${at(74)} ${at(92)} ${at(50)} ${at(93)} C ${at(26)} ${at(92)} ${at(10)} ${at(76)} ${at(15)} ${at(52)} C ${at(20)} ${at(28)} ${at(32 - v)} ${at(7)} ${at(50)} ${at(7)} Z`
  }
  if (kind === 'capsule') {
    return `M ${at(28)} ${at(27 - v)} L ${at(72)} ${at(28)} C ${at(88)} ${at(28)} ${at(94)} ${at(38)} ${at(93)} ${at(51)} C ${at(92)} ${at(65)} ${at(84)} ${at(73 + v)} ${at(70)} ${at(74)} L ${at(27)} ${at(73)} C ${at(13)} ${at(72)} ${at(6)} ${at(64)} ${at(7)} ${at(50)} C ${at(8)} ${at(36)} ${at(14)} ${at(28)} ${at(28)} ${at(27 - v)} Z`
  }
  if (kind === 'triangle') {
    return `M ${at(45)} ${at(15)} C ${at(47)} ${at(9)} ${at(53)} ${at(9)} ${at(56)} ${at(15)} L ${at(90)} ${at(70 + v)} C ${at(96)} ${at(82)} ${at(87)} ${at(91)} ${at(74)} ${at(91)} L ${at(26)} ${at(91)} C ${at(13)} ${at(91)} ${at(4)} ${at(82)} ${at(10)} ${at(70 + v)} L ${at(41)} ${at(20)} C ${at(42)} ${at(18)} ${at(43)} ${at(16)} ${at(45)} ${at(15)} Z`
  }
  if (kind === 'pentagon') return roundedPolygon(5, box, -Math.PI / 2, 42 + v, 42, 9)
  if (kind === 'hexagon') return roundedPolygon(6, box, 0, 43, 40 + v, 8)
  if (kind === 'tall-hexagon') return roundedPolygon(6, box, -Math.PI / 2, 37 + v, 44, 8)
  if (kind === 'octagon') return roundedPolygon(8, box, Math.PI / 8, 43 + v, 42, 6.5)
  if (kind === 'decagon') return roundedPolygon(10, box, -Math.PI / 2, 43, 43 + v, 5.5)
  return `M ${at(21)} ${at(73)} C ${at(8)} ${at(61)} ${at(15)} ${at(39)} ${at(30)} ${at(33)} C ${at(36)} ${at(12)} ${at(64 + v)} ${at(9)} ${at(72)} ${at(29)} C ${at(94)} ${at(34)} ${at(96)} ${at(64)} ${at(78)} ${at(73)} C ${at(68)} ${at(91)} ${at(42)} ${at(90)} ${at(34)} ${at(78)} C ${at(29)} ${at(80)} ${at(25)} ${at(78)} ${at(21)} ${at(73)} Z`
}

export function petPath(pet: Pick<Pet, 'kind' | 'variant'>, box: number = PET_GRID): string {
  return bodyFor(pet.kind, pet.variant, box)
}

function makePet(seed: string): Pet {
  const rand = prng(seed)
  const hue = Math.floor(rand() * 360)
  const kind = PET_SHAPE_STREAM[Math.floor(rand() * PET_SHAPE_STREAM.length)]
  const variant = rand() * 2 - 1
  rand()
  const yRoll = rand()
  const gapRoll = rand()
  const tilt = -3 + rand() * 6
  const room = EYE_ROOMS[kind]
  const size = eyeSize({ kind })
  const extent = eyeExtents(size, tilt)
  const minimumGap = size.width + (MIN_EYE_GAP * PET_GRID) / 20
  const maximumGap = Math.min(21, room.right - room.left - extent.x * 2 - 2)
  const eyeGap = minimumGap + gapRoll * Math.max(0, maximumGap - minimumGap)
  const left = room.left + extent.x + eyeGap / 2
  const right = room.right - extent.x - eyeGap / 2
  const top = room.top + extent.y
  const bottom = room.bottom - extent.y
  const eyeX = (left + right) / 2
  const eyeY = top + (bottom - top) * (0.48 + (yRoll - 0.5) * 0.08)
  const pet = { hue, kind, variant, eyeX, eyeY, eyeGap, tilt, body: '' }
  return { ...pet, body: petPath(pet) }
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

export function eyeGapAt(pet: Pet, box: number): number {
  return Math.max(pet.eyeGap, eyeSize(pet).width + (MIN_EYE_GAP * PET_GRID) / box)
}

export function eyesFit(pet: Pet): boolean {
  const room = EYE_ROOMS[pet.kind]
  const extent = eyeExtents(eyeSize(pet), pet.tilt)
  return (
    pet.eyeX - pet.eyeGap / 2 - extent.x >= room.left &&
    pet.eyeX + pet.eyeGap / 2 + extent.x <= room.right &&
    pet.eyeY - extent.y >= room.top &&
    pet.eyeY + extent.y <= room.bottom
  )
}

export function petHue(seed: string): number {
  return petOf(seed).hue
}
