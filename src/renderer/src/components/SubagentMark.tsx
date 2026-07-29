import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { paletteFor } from '../../../shared/art'
import { coverFor } from './art/coverArt'
import { GRAIN, meshOf } from './art/mesh'
import { shapePath, subagentShape } from './art/subagentShape'

// A helper's mark: the same field the covers are photographed in, seen through a
// shape of its own. It stands beside AgentIcon rather than in `icons/`, because
// it is a generated mark and not one of Crew's own drawings, which is the ground
// AgentIcon already holds.

// The same boxes AgentIcon takes, so a mark reserves the room a pet does and a
// row holding both lines up. The drawing sits on its own keyline inside that,
// the way a glyph does.
const SIZES = {
  xs: 20,
  sm: 28,
  md: 40,
  lg: 48
} as const

const DOTS = {
  xs: 'w-1.5 h-1.5 ring-2',
  sm: 'w-2 h-2 ring-2',
  md: 'w-2.5 h-2.5 ring-2',
  lg: 'w-3 h-3 ring-[2.5px]'
} as const

// Under this the shader is not worth what it buys. A row of chips is a dozen
// marks, the picture is drawn at 512 and cached per id, and a wall of them on
// the first paint of a panel costs more than the difference can be seen.
const WORTH_DRAWING = 40

export default function SubagentMark({
  seed,
  size = 'md',
  presence,
  className = ''
}: {
  seed: string
  size?: keyof typeof SIZES
  presence?: 'online' | 'offline'
  className?: string
}) {
  const box = SIZES[size]
  const tile = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(box >= WORTH_DRAWING)
  const clip = useId()
  const subject = useMemo(() => ({ id: seed, colors: paletteFor(seed) }), [seed])
  const path = useMemo(() => shapePath(subagentShape(seed), box), [seed, box])

  useEffect(() => {
    if (box < WORTH_DRAWING) {
      setDrawn(false)
      return
    }
    const canvas = tile.current
    if (!canvas) return
    const art = coverFor(subject)
    if (!art) {
      setDrawn(false)
      return
    }
    const grid = Math.round(box * Math.min(3, window.devicePixelRatio || 1))
    canvas.width = grid
    canvas.height = grid
    const flat = canvas.getContext('2d')
    if (!flat) return
    flat.drawImage(art, 0, 0, grid, grid)
    setDrawn(true)
  }, [subject, box])

  return (
    <span
      className={`relative inline-block align-middle shrink-0 ${className}`}
      style={{ width: box, height: box }}
    >
      {drawn ? (
        <canvas
          ref={tile}
          aria-hidden
          style={{ clipPath: `path('${path}')` }}
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <span aria-hidden style={{ ...meshOf(subject, box), clipPath: `path('${path}')` }} className="absolute inset-0" />
      )}
      <span
        aria-hidden
        style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px', clipPath: `path('${path}')` }}
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
      />
      {/* Nothing is drawn around the outside: an edge painted there is cropped
          the moment the mark lands in a scroller or a card that clips. The ring
          follows the silhouette rather than a box around it, so a rosette holds
          its edge the way a disc does. */}
      <svg viewBox={`0 0 ${box} ${box}`} className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <clipPath id={clip}>
            <path d={path} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <path d={path} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth={2} />
        </g>
      </svg>
      {presence && (
        <span
          className={`${DOTS[size]} absolute bottom-0 right-0 z-10 rounded-full ring-ink-900 transition-colors ${
            presence === 'online' ? 'bg-positive' : 'bg-ink-500'
          }`}
        />
      )}
    </span>
  )
}
