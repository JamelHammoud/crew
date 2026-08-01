import { type CSSProperties } from 'react'
import { typingLine, typistsIn } from '../../../shared/typing'
import { useCrew } from '../state/store'
import { DOT_R, THINKING_DOTS } from './toolGlyphs'

const DOTS = THINKING_DOTS.map((cx, index) => ({ cx, delay: `${index * 140}ms` }))

// The ellipsis is the app's own: the same three dots on the same grid, carrying
// the same wave a thought carries while it is still going.
function TypingDots() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className="typing-dots w-3 h-3 shrink-0">
      {DOTS.map(dot => (
        <circle
          key={dot.cx}
          className="typing-dot"
          cx={dot.cx}
          cy={12}
          r={DOT_R}
          fill="currentColor"
          style={{ '--dot-delay': dot.delay } as CSSProperties}
        />
      ))}
    </svg>
  )
}

// Who else is writing into the same box. It stands under the composer, in the
// room that is already there, so it covers no message and nothing moves when
// somebody starts or stops. Quiet: the smallest size in the ramp, muted, no
// surface of its own, and it fades in rather than popping.
export default function TypingLine({ where }: { where?: string }) {
  const selfId = useCrew(state => state.selfId)
  const typists = useCrew(state => state.typists)
  const here = typistsIn(typists, where, selfId)
  if (here.length === 0) return null

  return (
    <div className="absolute left-0 top-full max-w-full z-20 pointer-events-none flex items-center h-4 gap-1.5 pl-5 pr-3 text-xs text-fg-muted animate-fade">
      <TypingDots />
      <span className="truncate">{typingLine(here.map(typist => typist.name))}</span>
    </div>
  )
}
