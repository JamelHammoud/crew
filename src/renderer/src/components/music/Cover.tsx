import type { MusicItem } from '../../../../shared/music'

// A track's cover is a mesh of its own four colors: four soft lights laid over
// each other on a dark ground. Where each one sits is worked out from the id, so
// a track looks the same to everyone and no two look alike.
const seedOf = (id: string): number => {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return hash >>> 0
}

const spots = (id: string, count: number): Array<[number, number]> => {
  const seed = seedOf(id)
  return Array.from({ length: count }, (_, i) => {
    const x = ((seed >> (i * 5)) % 7) / 6
    const y = ((seed >> (i * 5 + 3)) % 7) / 6
    // Kept off the very edge, where a light is more of a corner than a color.
    return [12 + x * 76, 12 + y * 76] as [number, number]
  })
}

export function coverStyle(item: MusicItem): { backgroundColor: string; backgroundImage: string } {
  const colors = item.colors
  const places = spots(item.id, colors.length)
  const lights = colors.map(
    (color, i) => `radial-gradient(circle at ${places[i][0]}% ${places[i][1]}%, ${color} 0%, transparent 62%)`
  )
  return {
    backgroundColor: colors[colors.length - 1] ?? '#000',
    backgroundImage: lights.join(', ')
  }
}

// The mesh is drawn once and only ever moved, so a cover breathing costs the
// same as a cover standing still.
export default function Cover({
  item,
  playing = false,
  className = '',
  children
}: {
  item: MusicItem
  playing?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <span
        aria-hidden
        style={coverStyle(item)}
        className={`absolute -inset-[15%] bg-cover ${playing ? 'animate-drift' : ''}`}
      />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent to-black/25" />
      {children}
    </span>
  )
}
