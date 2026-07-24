import { useTheme } from '../state/theme'

const SIZES = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-12 h-12'
} as const

const DOTS = {
  sm: 'w-2 h-2 ring-2',
  md: 'w-2.5 h-2.5 ring-2',
  lg: 'w-3 h-3 ring-[2.5px]'
} as const

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

const EYE_RADIUS = 4.5

interface Pet {
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

function petOf(seed: string): Pet {
  let pet = pets.get(seed)
  if (!pet) {
    pet = makePet(seed)
    pets.set(seed, pet)
  }
  return pet
}

export function petHue(seed: string): number {
  return petOf(seed).hue
}

export default function AgentIcon({
  seed,
  size = 'md',
  presence
}: {
  seed: string
  size?: keyof typeof SIZES
  presence?: 'online' | 'offline'
}) {
  const pet = petOf(seed)
  const light = useTheme() === 'light'
  const bg = light ? `oklch(0.93 0.05 ${pet.hue})` : `oklch(0.3 0.055 ${pet.hue})`
  const body = light ? `oklch(0.62 0.16 ${pet.hue})` : `oklch(0.76 0.15 ${pet.hue})`
  return (
    <span className={`${SIZES[size]} relative inline-block shrink-0 self-start`}>
      <svg viewBox="0 0 100 100" className="w-full h-full rounded-full select-none" aria-hidden>
        <rect width="100" height="100" fill={bg} />
        <g transform={`rotate(${pet.tilt} 50 54)`}>
          <path d={pet.body} fill={body} stroke={body} strokeWidth={7} strokeLinejoin="round" />
          <circle cx={50 - pet.eyeGap / 2} cy={pet.eyeY} r={EYE_RADIUS} fill={bg} />
          <circle cx={50 + pet.eyeGap / 2} cy={pet.eyeY} r={EYE_RADIUS} fill={bg} />
        </g>
      </svg>
      {presence && (
        <span
          className={`${DOTS[size]} absolute bottom-0 right-0 rounded-full ring-ink-900 transition-colors ${
            presence === 'online' ? 'bg-positive' : 'bg-ink-500'
          }`}
        />
      )}
    </span>
  )
}
