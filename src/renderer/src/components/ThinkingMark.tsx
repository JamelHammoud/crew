import type { CSSProperties } from 'react'

const DOTS = [
  { cx: 5.4, delay: '0ms', gather: '4.4px' },
  { cx: 18.6, delay: '260ms', gather: '-4.4px' }
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
      style={{ '--ring': running ? '1.9px' : '8.5px' } as CSSProperties}
      className={`thinking-mark w-[18px] h-[18px] shrink-0 transition-colors ${
        running ? 'text-fg' : 'text-fg-muted group-hover:text-fg-secondary'
      }`}
    >
      {DOTS.map(dot => (
        <circle
          key={dot.cx}
          className="thinking-dot"
          cx={dot.cx}
          cy={12}
          r={1.9}
          style={{ '--dot-delay': dot.delay, '--gather': dot.gather } as CSSProperties}
        />
      ))}
      <circle
        className="thinking-ring"
        cx={12}
        cy={12}
        r={1.9}
        style={{ '--dot-delay': '130ms' } as CSSProperties}
      />
      <path className="thinking-check" pathLength={1} d="m8.2 12.2 2.6 2.6 5-5.5" />
    </svg>
  )
}
