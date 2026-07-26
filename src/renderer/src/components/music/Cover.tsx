import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { MusicItem } from '../../../../shared/music'
import { coverFor } from './coverArt'
import { GRAIN, meshOf } from './mesh'

// The picture is drawn once at a size of its own and painted into the tile from
// there, so the same cover can stand at the top of the panel and in the list
// without being drawn twice. A machine with no graphics context to give falls
// back to the stack of gradients in `mesh.ts`, which is the same palette and the
// same seed, softer.
export default function Cover({
  item,
  size,
  playing = false,
  className = '',
  children
}: {
  item: MusicItem
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
    const grid = Math.round(size * Math.min(3, window.devicePixelRatio || 1))
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
          className={`absolute inset-0 w-full h-full ${playing ? 'animate-drift' : ''}`}
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
