import type { Tab } from './TopBar'

const SVG = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

/** Speech bubble draws itself, then the three dots land one after another. */
function ChatIcon() {
  return (
    <svg {...SVG}>
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M6.5 4H13.5A3 3 0 0 1 16.5 7V10.5A3 3 0 0 1 13.5 13.5H9.5L6.2 16.1A0.6 0.6 0 0 1 5.2 15.6V13.3A3 3 0 0 1 3.5 10.5V7A3 3 0 0 1 6.5 4Z"
        style={{ '--draw-dur': '340ms' } as React.CSSProperties}
      />
      {[7.4, 10, 12.6].map((cx, i) => (
        <circle
          key={cx}
          className="tab-icon-pop"
          cx={cx}
          cy={8.75}
          r={0.95}
          fill="currentColor"
          stroke="none"
          style={{ '--pop-delay': `${200 + i * 70}ms` } as React.CSSProperties}
        />
      ))}
    </svg>
  )
}

/** Two orbits sweep out from the core, then a satellite settles onto the outer ring. */
function SpaceIcon() {
  return (
    <svg {...SVG}>
      <circle className="tab-icon-pop" cx={10} cy={10} r={2.1} fill="currentColor" stroke="none" />
      <ellipse
        className="tab-icon-draw"
        pathLength={1}
        cx={10}
        cy={10}
        rx={7.6}
        ry={3.4}
        transform="rotate(-28 10 10)"
        style={{ '--draw-dur': '360ms', '--draw-delay': '60ms' } as React.CSSProperties}
      />
      <ellipse
        className="tab-icon-draw"
        pathLength={1}
        cx={10}
        cy={10}
        rx={7.6}
        ry={3.4}
        transform="rotate(52 10 10)"
        style={{ '--draw-dur': '360ms', '--draw-delay': '150ms' } as React.CSSProperties}
      />
      <circle
        className="tab-icon-pop"
        cx={16.1}
        cy={6.8}
        r={1.35}
        fill="currentColor"
        stroke="none"
        style={{ '--pop-delay': '400ms' } as React.CSSProperties}
      />
    </svg>
  )
}

/** Page outline draws, the corner folds over, then the text lines rule themselves in. */
function DocsIcon() {
  return (
    <svg {...SVG}>
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M11 2.75H6.25A1.75 1.75 0 0 0 4.5 4.5V15.5A1.75 1.75 0 0 0 6.25 17.25H13.75A1.75 1.75 0 0 0 15.5 15.5V7.25Z"
        style={{ '--draw-dur': '360ms' } as React.CSSProperties}
      />
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M11 2.75V6.25A1 1 0 0 0 12 7.25H15.5"
        style={{ '--draw-dur': '180ms', '--draw-delay': '260ms' } as React.CSSProperties}
      />
      {[
        { y: 10.75, x2: 12.75 },
        { y: 13.25, x2: 12.75 },
        { y: 15.75, x2: 10.5 }
      ].map((line, i) => (
        <path
          key={line.y}
          className="tab-icon-draw"
          pathLength={1}
          strokeWidth={1.5}
          d={`M7.25 ${line.y}H${line.x2}`}
          style={
            { '--draw-dur': '160ms', '--draw-delay': `${340 + i * 70}ms` } as React.CSSProperties
          }
        />
      ))}
    </svg>
  )
}

const ICONS: Record<Tab, () => React.ReactElement> = {
  chat: ChatIcon,
  agents: SpaceIcon,
  docs: DocsIcon
}

export default function TabIcon({ tab }: { tab: Tab }) {
  const Icon = ICONS[tab]
  return (
    <span className="tab-icon" aria-hidden="true">
      <Icon />
    </span>
  )
}
