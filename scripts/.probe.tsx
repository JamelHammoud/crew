import type { ReactNode } from 'react'
import { glyph } from '../src/renderer/src/components/glyph'
import type { Glyph } from '../src/renderer/src/components/glyph'
import { CameraGlyph, DesktopGlyph, ExpandGlyph, HangupGlyph, MicGlyph } from '../src/renderer/src/icons'

const round = (n: number) => Math.round(n * 100) / 100
const xy = (p: number[]) => `${round(p[0])} ${round(p[1])}`

// The handset seen from the front: a deep arch with a pad at each end. Every
// number is read off one circle, so the bar, the legs and the pads cannot drift
// apart from one another.
const arch = ({
  cy,
  rx,
  ry,
  bar,
  spanOut,
  spanIn
}: {
  cy: number
  rx: number
  ry: number
  bar: number
  spanOut: number
  spanIn: number
}) => {
  const on = (grow: number, span: number, side: number) => {
    const rad = (span * Math.PI) / 180
    return [12 + (rx + grow) * side * Math.sin(rad), cy - (ry + grow) * Math.cos(rad)]
  }
  const O = (side: number) => on(bar / 2, spanOut, side)
  const I = (side: number) => on(-bar / 2, spanIn, side)
  const cap = round(Math.hypot(O(1)[0] - I(1)[0], O(1)[1] - I(1)[1]) / 2)
  return [
    `M${xy(O(-1))}`,
    `A${round(rx + bar / 2)} ${round(ry + bar / 2)} 0 1 1 ${xy(O(1))}`,
    `A${cap} ${cap} 0 0 1 ${xy(I(1))}`,
    `A${round(rx - bar / 2)} ${round(ry - bar / 2)} 0 1 0 ${xy(I(-1))}`,
    `A${cap} ${cap} 0 0 1 ${xy(O(-1))}`,
    'Z'
  ].join('')
}

const filled = (d: string) => glyph(<path d={d} fill="currentColor" stroke="none" />)
const outlined = (d: string) => glyph(<path d={d} />)

const WIDE_A = arch({ cy: 13.5, rx: 8, ry: 6.4, bar: 3.2, spanOut: 118, spanIn: 100 })
const WIDE_B = arch({ cy: 13.3, rx: 8, ry: 6.4, bar: 3.2, spanOut: 124, spanIn: 96 })
const WIDE_C = arch({ cy: 13.6, rx: 8.2, ry: 6.2, bar: 3, spanOut: 115, spanIn: 102 })
const ROUND_D = arch({ cy: 13.2, rx: 6.9, ry: 6.9, bar: 2.8, spanOut: 130, spanIn: 98 })

const DIAGONAL =
  'M10.06 5.25A3.4 3.4 0 0 0 5.25 10.06Q8.18 15.82 13.94 18.75A3.4 3.4 0 0 0 18.75 13.94Q7.33 16.67 10.06 5.25Z'

const CANDIDATES: { label: string; glyph: Glyph }[] = [
  { label: 'now', glyph: HangupGlyph },
  { label: 'diagonal', glyph: filled(DIAGONAL) },
  { label: 'wide 118/100', glyph: filled(WIDE_A) },
  { label: 'wide 124/96', glyph: filled(WIDE_B) },
  { label: 'wide thin bar', glyph: filled(WIDE_C) },
  { label: 'round 130/98', glyph: filled(ROUND_D) },
  { label: 'wide A outlined', glyph: outlined(WIDE_A) }
]

function Button({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: danger ? 'rgba(248,113,113,0.15)' : 'rgba(245,245,245,0.08)',
        color: danger ? '#f87171' : '#b3b3b3'
      }}
    >
      {children}
    </span>
  )
}

function Bar({ leave: Leave, label }: { leave: Glyph; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 16 }}>
      <span style={{ width: 104, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</span>
      <span
        style={{
          display: 'flex',
          gap: 8,
          padding: 8,
          borderRadius: 999,
          background: 'rgba(28,29,32,0.72)',
          border: '1px solid rgba(245,245,245,0.08)'
        }}
      >
        <Button>
          <MicGlyph className="w-[18px] h-[18px]" />
        </Button>
        <Button>
          <CameraGlyph className="w-[18px] h-[18px]" />
        </Button>
        <Button>
          <DesktopGlyph className="w-[18px] h-[18px]" />
        </Button>
        <Button>
          <ExpandGlyph className="w-[18px] h-[18px]" />
        </Button>
        <Button danger>
          <Leave className="w-[18px] h-[18px]" />
        </Button>
      </span>
      <span style={{ display: 'flex', gap: 16, alignItems: 'center', color: '#f87171' }}>
        <Leave className="w-4 h-4" />
        <Leave className="w-5 h-5" />
        <Leave className="w-6 h-6" />
        <Leave className="w-12 h-12" />
      </span>
      <span style={{ display: 'flex', gap: 14, alignItems: 'center', color: 'rgba(245,245,245,0.8)' }}>
        <Leave className="w-4 h-4" />
        <Leave className="w-12 h-12" />
      </span>
    </div>
  )
}

export default function Probe() {
  return (
    <div>
      {CANDIDATES.map(row => (
        <Bar key={row.label} label={row.label} leave={row.glyph} />
      ))}
    </div>
  )
}
