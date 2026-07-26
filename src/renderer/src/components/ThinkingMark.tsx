import type { CSSProperties } from 'react'
import { CHECK_PATH, DOT_R, RING_R, THINKING_DOTS } from './toolGlyphs'

const [LEFT, MIDDLE, RIGHT] = THINKING_DOTS

const SIDES = [
  { cx: LEFT, delay: '0ms', gather: `${(MIDDLE - LEFT) * 0.66}px` },
  { cx: RIGHT, delay: '260ms', gather: `${(MIDDLE - RIGHT) * 0.66}px` }
]

export default function ThinkingMark({ running }: { running: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-state={running ? 'thinking' : 'thought'}
      style={{ '--ring': `${running ? DOT_R : RING_R}px` } as CSSProperties}
      className={`thinking-mark w-[18px] h-[18px] shrink-0 transition-colors ${
        running ? 'text-fg' : 'text-fg-muted group-hover:text-fg-secondary'
      }`}
    >
      {SIDES.map(dot => (
        <circle
          key={dot.cx}
          className="thinking-dot"
          cx={dot.cx}
          cy={12}
          r={DOT_R}
          style={{ '--dot-delay': dot.delay, '--gather': dot.gather } as CSSProperties}
        />
      ))}
      <circle
        className="thinking-ring"
        cx={MIDDLE}
        cy={12}
        r={DOT_R}
        style={{ '--dot-delay': '130ms' } as CSSProperties}
      />
      <path className="thinking-check" pathLength={1} d={CHECK_PATH} />
    </svg>
  )
}
