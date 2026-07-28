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

const BLEED = 180

const ROOM = 20

const BOX = { x: 0, y: 0, width: MARK_WIDTH, height: MARK_HEIGHT }

const FIELD = {
  x: -BLEED,
  y: -BLEED,
  width: MARK_WIDTH + BLEED * 2,
  height: MARK_HEIGHT + BLEED * 2
}

const STAGE = MARK_HEIGHT + ROOM * 2

// `sky` is the field the blobs are lit against, and only a mesh behind a mask
// has one. Unmasked it is a rectangle, and a blurred rectangle reads as a box
// standing behind the mark rather than as light coming off it.
function Mesh({ id, sky = true }: { id: string; sky?: boolean }) {
  return (
    <>
      <defs>
        {BLOBS.map((blob, index) => (
          <radialGradient key={blob.color} id={`${id}-b${index}`}>
            <stop offset="0" stopColor={blob.color} stopOpacity="0.95" />
            <stop offset="0.45" stopColor={blob.color} stopOpacity="0.62" />
            <stop offset="1" stopColor={blob.color} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <g className="crew-mesh">
        <rect {...FIELD} fill={SKY} />
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
    </>
  )
}

// The light the mark splits, spilling onto whatever is behind it. It is the
// same field the discs are windows onto, drawn without the mask and thrown
// wide, so the boot is lit by the mark itself rather than by a second picture.
export function CrewGlow({ className = '' }: { className?: string }) {
  const raw = useId()
  const id = raw.replace(/[^a-zA-Z0-9-]/g, '')

  return (
    <svg
      viewBox={`${FIELD.x} ${FIELD.y} ${FIELD.width} ${FIELD.height}`}
      aria-hidden
      className={`crew-glow ${className}`}
    >
      <Mesh id={id} />
    </svg>
  )
}

export function CrewMark({
  className = '',
  live = false,
  height
}: {
  className?: string
  live?: boolean
  height?: number
}) {
  const raw = useId()
  const id = raw.replace(/[^a-zA-Z0-9-]/g, '')
  const last = MARK_DISCS.length - 1
  const field = live ? FIELD : BOX
  const view = live
    ? `${-ROOM} ${-ROOM} ${MARK_WIDTH + ROOM * 2} ${STAGE}`
    : `0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`

  return (
    <svg
      viewBox={view}
      role="img"
      aria-label="crew"
      style={height === undefined ? undefined : { height: (height * STAGE) / MARK_HEIGHT }}
      className={live ? `crew-mark ${className}` : className}
    >
      <mask id={id} maskUnits="userSpaceOnUse" {...field}>
        <rect {...field} fill="#000000" />
        {MARK_DISCS.map((cx, index) => (
          <g
            key={cx}
            className={live ? 'crew-disc' : undefined}
            style={live ? ({ '--disc': last - index } as CSSProperties) : undefined}
          >
            {index > 0 && <circle cx={cx} cy={MARK_RADIUS} r={MARK_CUT} fill="#000000" />}
            <circle cx={cx} cy={MARK_RADIUS} r={MARK_RADIUS} fill="#ffffff" />
          </g>
        ))}
      </mask>

      <g mask={`url(#${id})`}>
        <rect {...field} fill="currentColor" />
        {live && (
          <>
            <Mesh id={id} />
            <rect className="crew-flash" {...FIELD} fill="#ffffff" />
          </>
        )}
      </g>
    </svg>
  )
}
