import { type CSSProperties } from 'react'
import { typingLine, typistsIn } from '../../../shared/typing'
import { useCrew } from '../state/store'
import { DOT_R, THINKING_DOTS } from './toolGlyphs'

const DOTS = THINKING_DOTS.map((cx, index) => ({ cx, delay: `${index * 140}ms` }))

// The ellipsis after the name is the app's own: the same three dots on the same
// grid, carrying the same wave a thought carries while it is still going.
function TypingDots() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className="typing-dots w-4 h-4 shrink-0">
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

// Who else is writing into the same box, standing over the composer so nothing
// under it moves when somebody starts or stops. It is glass, so the words on it
// take the foreground at an opacity rather than a solid grey.
export default function TypingLine({ where }: { where?: string }) {
  const selfId = useCrew(state => state.selfId)
  const typists = useCrew(state => state.typists)
  const here = typistsIn(typists, where, selfId)
  if (here.length === 0) return null

  return (
    <div className="glass absolute -top-14 left-0 z-20 flex items-center h-9 gap-1 pl-3.5 pr-2.5 rounded-full text-sm font-medium text-fg/70 animate-pop">
      {typingLine(here.map(typist => typist.name))}
      <TypingDots />
    </div>
  )
}
