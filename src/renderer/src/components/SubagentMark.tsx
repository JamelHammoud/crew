import { useId, useMemo } from 'react'
import GeneratedField from './art/GeneratedField'
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

export default function SubagentMark({
  seed,
  size = 'md',
  presence,
  className = ''
}: {
  seed: string
  // One of the boxes above, or a size of its own where a mark stands in a row
  // built to another measure, like a tab pill.
  size?: keyof typeof SIZES | number
  presence?: 'online' | 'offline'
  className?: string
}) {
  const box = typeof size === 'number' ? size : SIZES[size]
  const clip = useId()
  const path = useMemo(() => shapePath(subagentShape(seed), box), [seed, box])

  return (
    <span className={`relative inline-block align-middle shrink-0 ${className}`} style={{ width: box, height: box }}>
      <GeneratedField seed={seed} box={box} clip={`path('${path}')`} />
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
          className={`${typeof size === 'number' ? DOTS.xs : DOTS[size]} absolute bottom-0 right-0 z-10 rounded-full ring-ink-900 transition-colors ${
            presence === 'online' ? 'bg-positive' : 'bg-ink-500'
          }`}
        />
      )}
    </span>
  )
}
