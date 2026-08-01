import { useId, type ComponentType, type ReactNode } from 'react'
import { GRID, STROKE, wearWeight } from '../icons/keylines'

export type Glyph = ComponentType<{ className?: string; strokeWidth?: number }>

// The weight a drawing carries is the weight it wants at 16, which is where
// nearly everything in the app is worn. Worn smaller or larger, the stroke is
// adjusted for it: a stroke does not scale with the icon, so the same number
// comes out spindly on a 12 and chunky on a 32. The size is read off the class
// the caller already writes, so no call site has to know any of this, and a
// strokeWidth of its own still wins.
export function glyph(art: ReactNode, weight = STROKE): Glyph {
  return function CrewGlyph({
    className = 'w-4 h-4',
    strokeWidth
  }: {
    className?: string
    strokeWidth?: number
  }) {
    const id = useId().replace(/[^a-zA-Z0-9-]/g, '')
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        viewBox={`0 0 ${GRID} ${GRID}`}
        className={className}
      >
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={GRID} height={GRID}>
          <g
            style={{ color: '#fff' }}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth ?? wearWeight(weight, className)}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {art}
          </g>
        </mask>
        <rect width={GRID} height={GRID} fill="currentColor" mask={`url(#${id})`} />
      </svg>
    )
  }
}
