import type { Tab } from './TopBar'

const SVG = {
  className: 'tab-icon-svg',
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.55,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

/** Bubble strokes itself in one pass, then the three dots land left to right. */
function ChatIcon() {
  return (
    <svg {...SVG}>
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M6.2 3.5H13.8A3.2 3.2 0 0 1 17 6.7V10.1A3.2 3.2 0 0 1 13.8 13.3H8.9L6.05 16.05Q5.25 16.75 5.25 15.7V13.05A3.2 3.2 0 0 1 3 10.1V6.7A3.2 3.2 0 0 1 6.2 3.5Z"
        style={{ '--draw-dur': '320ms' } as React.CSSProperties}
      />
      {[7.1, 10, 12.9].map((cx, i) => (
        <circle
          key={cx}
          className="tab-icon-pop"
          cx={cx}
          cy={8.4}
          r={0.9}
          fill="currentColor"
          stroke="none"
          style={{ '--pop-delay': `${215 + i * 65}ms` } as React.CSSProperties}
        />
      ))}
    </svg>
  )
}

/** Core pops, two orbits swing open from opposite tilts, a satellite slides along the ring. */
function SpaceIcon() {
  return (
    <svg {...SVG}>
      <circle className="tab-icon-pop" cx={10} cy={10} r={1.75} fill="currentColor" stroke="none" />
      <g
        className="tab-icon-sweep"
        style={{ '--sweep-from': '-26deg', '--sweep-delay': '70ms' } as React.CSSProperties}
      >
        <path
          className="tab-icon-draw"
          pathLength={1}
          d={ORBIT}
          style={{ '--draw-dur': '340ms', '--draw-delay': '70ms' } as React.CSSProperties}
        />
        <circle
          className="tab-icon-orbit"
          r={1.2}
          fill="currentColor"
          stroke="none"
          style={{ offsetPath: `path("${ORBIT}")` } as React.CSSProperties}
        />
      </g>
      <g
        className="tab-icon-sweep"
        style={{ '--sweep-from': '26deg', '--sweep-delay': '150ms' } as React.CSSProperties}
      >
        <path
          className="tab-icon-draw"
          pathLength={1}
          d={ORBIT_MIRROR}
          style={{ '--draw-dur': '340ms', '--draw-delay': '150ms' } as React.CSSProperties}
        />
      </g>
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
        d="M11.2 2.6H6.2A1.8 1.8 0 0 0 4.4 4.4V15.6A1.8 1.8 0 0 0 6.2 17.4H13.8A1.8 1.8 0 0 0 15.6 15.6V7Z"
        style={{ '--draw-dur': '340ms' } as React.CSSProperties}
      />
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M11.2 2.6V6A1 1 0 0 0 12.2 7H15.6"
        style={{ '--draw-dur': '170ms', '--draw-delay': '250ms' } as React.CSSProperties}
      />
      {[
        { y: 10.7, x2: 12.8 },
        { y: 13, x2: 12.8 },
        { y: 15.3, x2: 10.4 }
      ].map((line, i) => (
        <path
          key={line.y}
          className="tab-icon-draw"
          pathLength={1}
          strokeWidth={1.45}
          d={`M7.2 ${line.y}H${line.x2}`}
          style={
            { '--draw-dur': '150ms', '--draw-delay': `${330 + i * 65}ms` } as React.CSSProperties
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
