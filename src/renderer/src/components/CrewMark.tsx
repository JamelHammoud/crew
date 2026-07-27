import { useId, type CSSProperties } from 'react'
import { MARK_CUT, MARK_DISCS, MARK_HEIGHT, MARK_RADIUS, MARK_WIDTH } from './crew-mark'

const SKY = '#5a3fd6'

const BLOBS = [
  { color: '#2dd4ff', cx: 96, cy: 62, r: 236, dx: 46, dy: 34, ds: 1.14, dur: '7.4s', lag: '0s' },
  { color: '#a855f7', cx: 296, cy: 208, r: 244, dx: -52, dy: -40, ds: 1.09, dur: '9.1s', lag: '-1.2s' },
  { color: '#ff5d8f', cx: 412, cy: 40, r: 214, dx: 38, dy: 52, ds: 1.16, dur: '8.3s', lag: '-2.6s' },
  { color: '#ffb14a', cx: 552, cy: 196, r: 248, dx: -44, dy: -34, ds: 1.11, dur: '10.6s', lag: '-0.7s' },
  { color: '#ffffff', cx: 158, cy: 24, r: 118, dx: 30, dy: 44, ds: 1.22, dur: '6.8s', lag: '-3.4s' }
]

const SWEEP_X = 700

export function CrewMark({ className = '', run }: { className?: string; run?: number }) {
  const raw = useId()
  const id = raw.replace(/[^a-zA-Z0-9-]/g, '')
  const live = run !== undefined

  return (
    <svg
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      role="img"
      aria-label="crew"
      className={live ? `crew-mark ${className}` : className}
    >
      {live && (
        <defs>
          {BLOBS.map((blob, index) => (
            <radialGradient key={blob.color} id={`${id}-b${index}`}>
              <stop offset="0" stopColor={blob.color} stopOpacity="0.95" />
              <stop offset="0.45" stopColor={blob.color} stopOpacity="0.62" />
              <stop offset="1" stopColor={blob.color} stopOpacity="0" />
            </radialGradient>
          ))}
          <radialGradient id={`${id}-sweep`}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
      )}

      <mask
        key={run}
        id={id}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
      >
        <rect x="0" y="0" width={MARK_WIDTH} height={MARK_HEIGHT} fill="#000000" />
        {MARK_DISCS.map((cx, index) => (
          <g
            key={cx}
            className={live ? 'crew-disc' : undefined}
            style={
              live
                ? ({
                    transformOrigin: `${cx}px ${MARK_RADIUS}px`,
                    '--disc': index
                  } as CSSProperties)
                : undefined
            }
          >
            {index > 0 && <circle cx={cx} cy={MARK_RADIUS} r={MARK_CUT} fill="#000000" />}
            <circle cx={cx} cy={MARK_RADIUS} r={MARK_RADIUS} fill="#ffffff" />
          </g>
        ))}
      </mask>

      <g mask={`url(#${id})`}>
        <rect x="0" y="0" width={MARK_WIDTH} height={MARK_HEIGHT} fill="currentColor" />
        {live && (
          <>
            <g className="crew-mesh">
              <rect x="0" y="0" width={MARK_WIDTH} height={MARK_HEIGHT} fill={SKY} />
              {BLOBS.map((blob, index) => (
                <circle
                  key={blob.color}
                  className="crew-blob"
                  cx={blob.cx}
                  cy={blob.cy}
                  r={blob.r}
                  fill={`url(#${id}-b${index})`}
                  style={
                    {
                      '--dx': `${blob.dx}px`,
                      '--dy': `${blob.dy}px`,
                      '--ds': blob.ds,
                      '--dur': blob.dur,
                      '--lag': blob.lag
                    } as CSSProperties
                  }
                />
              ))}
            </g>
            <g key={run}>
              <rect
                className="crew-flash"
                x="0"
                y="0"
                width={MARK_WIDTH}
                height={MARK_HEIGHT}
                fill="#ffffff"
              />
              <ellipse
                className="crew-sweep"
                cx={SWEEP_X}
                cy={MARK_RADIUS}
                rx="96"
                ry="200"
                fill={`url(#${id}-sweep)`}
              />
            </g>
          </>
        )}
      </g>
    </svg>
  )
}
