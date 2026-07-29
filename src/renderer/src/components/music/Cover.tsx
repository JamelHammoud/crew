import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CoverSubject } from '../../../../shared/music'
import { coverFor } from '../art/coverArt'
import { GRAIN, meshOf } from '../art/mesh'

// The picture is drawn once at a size of its own and painted into the tile from
// there, so the same cover can stand at the top of the panel and in the list
// without being drawn twice. A machine with no graphics context to give falls
// back to the stack of gradients in `mesh.ts`, which is the same palette and the
// same seed, softer.

// A picture that moves has to be bigger than the box it moves in. The canvas is
// laid in past all four edges by this much and the drift stays inside the
// margin, so there is picture under every corner at every frame of it. Held
// flush to the tile, the rotation alone walks the corners in: a square turned
// four degrees has to be scaled by 1.067 before it covers its own box again, and
// what showed in the gap was the panel behind the cover.
//
// The fallback needs none of this. Its own layer is already half again as big as
// the tile, because that is where the blur in `mesh.ts` spills to.
const BLEED = 0.07

// Said as a size and a corner rather than as four insets. A canvas is a replaced
// element, so it takes its own pixel size wherever its width is left to itself,
// and four insets on one of those are read as a suggestion.
const OVERSIZE = {
  left: `${-BLEED * 100}%`,
  top: `${-BLEED * 100}%`,
  width: `${(1 + BLEED * 2) * 100}%`,
  height: `${(1 + BLEED * 2) * 100}%`
}

export default function Cover({
  item,
  size,
  playing = false,
  className = '',
  children
}: {
  item: CoverSubject
  size: number
  playing?: boolean
  className?: string
  children?: ReactNode
}) {
  const tile = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(true)

  useEffect(() => {
    const box = tile.current
    if (!box) return
    const art = coverFor(item)
    if (!art) {
      setDrawn(false)
      return
    }
    const grid = Math.round(size * (1 + BLEED * 2) * Math.min(3, window.devicePixelRatio || 1))
    box.width = grid
    box.height = grid
    const flat = box.getContext('2d')
    if (!flat) return
    flat.drawImage(art, 0, 0, grid, grid)
    setDrawn(true)
  }, [item, size])

  return (
    <span className={`relative block overflow-hidden isolate ${className}`}>
      {drawn ? (
        <canvas
          ref={tile}
          aria-hidden
          style={OVERSIZE}
          className={`absolute ${playing ? 'animate-drift' : ''}`}
        />
      ) : (
        <span
          aria-hidden
          style={meshOf(item, size)}
          className={`absolute -inset-1/4 ${playing ? 'animate-drift' : ''}`}
        />
      )}
      <span
        aria-hidden
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }}
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
      />
      <span aria-hidden className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[inherit]" />
      {children}
    </span>
  )
}
