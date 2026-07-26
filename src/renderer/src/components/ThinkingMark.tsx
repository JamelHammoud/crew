import { useRef, type CSSProperties } from 'react'
import { STROKE, wearWeight } from '../icons/keylines'
import { CHECK_PATH, DOT_R, RING_R, THINKING_DOTS } from './toolGlyphs'

const MIDDLE = THINKING_DOTS[1]

// The one mark in the app that draws its own frame instead of going through
// glyph(), so it has to be handed the same stroke the rest of the set wears at
// the size it is worn at, or the thought sits thinner than the step above it.
const WORN = 'w-[18px] h-[18px]'

const DOTS = THINKING_DOTS.map((cx, index) => ({
  cx,
  delay: `${index * 140}ms`,
  gather: `${MIDDLE - cx}px`
}))

export default function ThinkingMark({ running }: { running: boolean }) {
  const watched = useRef(running)
  if (running) watched.current = true

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
      data-landing={!running && watched.current ? '' : undefined}
      style={{ '--ring': `${running ? DOT_R : RING_R}px` } as CSSProperties}
      className={`thinking-mark w-[18px] h-[18px] shrink-0 transition-colors ${
        running ? 'text-fg' : 'text-fg-muted group-hover:text-fg-secondary'
      }`}
    >
      <circle className="thinking-ring" cx={MIDDLE} cy={12} r={DOT_R} />
      {DOTS.map(dot => (
        <circle
          key={dot.cx}
          className="thinking-dot"
          cx={dot.cx}
          cy={12}
          r={DOT_R}
          fill="currentColor"
          stroke="none"
          style={{ '--dot-delay': dot.delay, '--gather': dot.gather } as CSSProperties}
        />
      ))}
      <path className="thinking-check" pathLength={1} d={CHECK_PATH} />
    </svg>
  )
}
