import { useId } from 'react'
import { MARK_CUT, MARK_DISCS, MARK_HEIGHT, MARK_RADIUS, MARK_WIDTH } from './crew-mark'

export function CrewMark({ className = '' }: { className?: string }) {
  const id = useId()
  return (
    <svg
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      role="img"
      aria-label="crew"
      className={className}
    >
      <mask
        id={id}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
      >
        <rect x="0" y="0" width={MARK_WIDTH} height={MARK_HEIGHT} fill="#000000" />
        {MARK_DISCS.map((cx, index) => (
          <g key={cx}>
            {index > 0 && <circle cx={cx} cy={MARK_RADIUS} r={MARK_CUT} fill="#000000" />}
            <circle cx={cx} cy={MARK_RADIUS} r={MARK_RADIUS} fill="#ffffff" />
          </g>
        ))}
      </mask>
      <rect
        x="0"
        y="0"
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        fill="currentColor"
        mask={`url(#${id})`}
      />
    </svg>
  )
}
