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
export const EYE_WIDTH = 8
export const EYE_HEIGHT = 17
export const EYE_RADIUS = EYE_WIDTH / 2
export const MIN_EYE_GAP = 1.2
export const FIELD_LIGHT = 1

export const PET_SHAPE_KINDS = ['circle', 'teardrop', 'cloud', 'square', 'egg', 'capsule', 'triangle'] as const

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

const rounded = (value: number): number => Math.round(value * 1000) / 1000

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
    return `M ${at(50)} ${at(7)} C ${at(58 + v)} ${at(20)} ${at(84)} ${at(37 - v)} ${at(87)} ${at(56)} C ${at(90)} ${at(76)} ${at(74)} ${at(91)} ${at(51)} ${at(92)} C ${at(28)} ${at(93)} ${at(11)} ${at(77)} ${at(14)} ${at(56)} C ${at(17)} ${at(37)} ${at(42 - v)} ${at(20)} ${at(50)} ${at(7)} Z`
  }
  if (kind === 'cloud') {
    return `M ${at(19)} ${at(76)} C ${at(7)} ${at(71)} ${at(6)} ${at(54)} ${at(17)} ${at(46)} C ${at(14)} ${at(31)} ${at(31)} ${at(21 - v)} ${at(44)} ${at(28)} C ${at(54)} ${at(14)} ${at(76)} ${at(21)} ${at(78)} ${at(39)} C ${at(94)} ${at(40)} ${at(98)} ${at(62)} ${at(85)} ${at(70)} C ${at(77)} ${at(84)} ${at(58 + v)} ${at(83)} ${at(49)} ${at(78)} C ${at(39)} ${at(87)} ${at(26)} ${at(84)} ${at(19)} ${at(76)} Z`
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
  return `M ${at(50)} ${at(8)} C ${at(55)} ${at(8)} ${at(59)} ${at(12)} ${at(63)} ${at(19)} L ${at(90)} ${at(70 + v)} C ${at(96)} ${at(82)} ${at(87)} ${at(91)} ${at(74)} ${at(91)} L ${at(26)} ${at(91)} C ${at(13)} ${at(91)} ${at(4)} ${at(82)} ${at(10)} ${at(70 + v)} L ${at(37)} ${at(19)} C ${at(41)} ${at(12)} ${at(45)} ${at(8)} ${at(50)} ${at(8)} Z`
}

export function petPath(pet: Pick<Pet, 'kind' | 'variant'>, box: number = PET_GRID): string {
  return bodyFor(pet.kind, pet.variant, box)
}

function makePet(seed: string): Pet {
  const rand = prng(seed)
  const hue = Math.floor(rand() * 360)
  const kind = PET_SHAPE_KINDS[Math.floor(rand() * PET_SHAPE_KINDS.length)]
  const variant = rand() * 2 - 1
  const eyeX = 53 + rand() * 5
  const eyeY = kind === 'triangle' ? 47 + rand() * 4 : kind === 'cloud' ? 43 + rand() * 4 : 39 + rand() * 5
  const eyeGap = 15 + rand() * 5
  const tilt = -13 + rand() * 10
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
  return Math.max(pet.eyeGap, EYE_WIDTH + (MIN_EYE_GAP * PET_GRID) / box)
}

export function petHue(seed: string): number {
  return petOf(seed).hue
}
