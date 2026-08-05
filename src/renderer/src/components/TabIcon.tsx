import { useId, type ReactNode } from 'react'
import type { NavTab } from './navTabs'

const BOX = 20

function Mark({ size, children }: { size: number; children: ReactNode }): React.ReactElement {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, '')
  return (
    <svg className="tab-icon-svg" width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={BOX} height={BOX}>
        <g
          style={{ color: '#fff' }}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.67}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {children}
        </g>
      </mask>
      <rect width={BOX} height={BOX} fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

/** Bubble strokes itself in one pass, then the three dots land left to right. */
function ChatIcon({ size }: { size: number }) {
  return (
    <Mark size={size}>
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
    </Mark>
  )
}

/** Page outline draws, the corner folds over, then the text lines rule themselves in. */
function DocsIcon({ size }: { size: number }) {
  return (
    <Mark size={size}>
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
        { y: 11, x2: 12.8 },
        { y: 13.5, x2: 10.4 }
      ].map((line, i) => (
        <path
          key={line.y}
          className="tab-icon-draw"
          pathLength={1}
          strokeWidth={1.56}
          d={`M7.2 ${line.y}H${line.x2}`}
          style={
            { '--draw-dur': '150ms', '--draw-delay': `${330 + i * 65}ms` } as React.CSSProperties
          }
        />
      ))}
    </Mark>
  )
}

/** Frame crop marks: the two rules draw across, then the two posts drop through them. */
function DesignIcon({ size }: { size: number }) {
  return (
    <Mark size={size}>
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M3.4 7.3H16.6"
        style={{ '--draw-dur': '200ms' } as React.CSSProperties}
      />
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M16.6 12.7H3.4"
        style={{ '--draw-dur': '200ms', '--draw-delay': '90ms' } as React.CSSProperties}
      />
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M7.3 3.4V16.6"
        style={{ '--draw-dur': '200ms', '--draw-delay': '200ms' } as React.CSSProperties}
      />
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M12.7 16.6V3.4"
        style={{ '--draw-dur': '200ms', '--draw-delay': '290ms' } as React.CSSProperties}
      />
    </Mark>
  )
}

function PluginsIcon({ size }: { size: number }) {
  return (
    <Mark size={size}>
      <path
        className="tab-icon-draw"
        pathLength={1}
        d="M5.4 6H7.8A2.2 2.2 0 0 1 12.2 6H14.6A2 2 0 0 1 16.6 8V14.2A2 2 0 0 1 14.6 16.2H5.4A2 2 0 0 1 3.4 14.2V12.6A2.2 2.2 0 0 0 3.4 8.2V8A2 2 0 0 1 5.4 6Z"
        style={{ '--draw-dur': '380ms' } as React.CSSProperties}
      />
    </Mark>
  )
}

export function MoreTabIcon({ size = 18 }: { size?: number }) {
  return (
    <span className="tab-icon" aria-hidden="true">
      <Mark size={size}>
        {[4.6, 10, 15.4].map((cx, i) => (
          <circle
            key={cx}
            className="tab-icon-pop"
            cx={cx}
            cy={10}
            r={1.2}
            fill="currentColor"
            stroke="none"
            style={{ '--pop-delay': `${i * 70}ms` } as React.CSSProperties}
          />
        ))}
      </Mark>
    </span>
  )
}

const ICONS: Record<NavTab, (props: { size: number }) => React.ReactElement> = {
  chat: ChatIcon,
  docs: DocsIcon,
  design: DesignIcon,
  plugins: PluginsIcon
}

export default function TabIcon({ tab, size = 20 }: { tab: NavTab; size?: number }) {
  const Icon = ICONS[tab]
  return (
    <span className="tab-icon" aria-hidden="true">
      <Icon size={size} />
    </span>
  )
}
