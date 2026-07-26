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
  mid,
  bar,
  spanOut,
  spanIn
}: {
  cy: number
  mid: number
  bar: number
  spanOut: number
  spanIn: number
}) => {
  const out = mid + bar / 2
  const inn = mid - bar / 2
  const on = (r: number, span: number, side: number) => {
    const rad = (span * Math.PI) / 180
    return [12 + r * side * Math.sin(rad), cy - r * Math.cos(rad)]
  }
  const O = (side: number) => on(out, spanOut, side)
  const I = (side: number) => on(inn, spanIn, side)
  const cap = round(Math.hypot(O(1)[0] - I(1)[0], O(1)[1] - I(1)[1]) / 2)
  return [
    `M${xy(O(-1))}`,
    `A${out} ${out} 0 1 1 ${xy(O(1))}`,
    `A${cap} ${cap} 0 0 1 ${xy(I(1))}`,
    `A${inn} ${inn} 0 1 0 ${xy(I(-1))}`,
    `A${cap} ${cap} 0 0 1 ${xy(O(-1))}`,
    'Z'
  ].join('')
}

const filled = (d: string) => glyph(<path d={d} fill="currentColor" stroke="none" />)
const outlined = (d: string) => glyph(<path d={d} />)

const FLARE_A = arch({ cy: 13.4, mid: 7, bar: 3.2, spanOut: 122, spanIn: 104 })
const FLARE_B = arch({ cy: 13.2, mid: 7, bar: 3.2, spanOut: 128, spanIn: 100 })
const FLARE_C = arch({ cy: 13.6, mid: 7, bar: 3, spanOut: 118, spanIn: 106 })
const FLARE_D = arch({ cy: 13.2, mid: 6.9, bar: 2.8, spanOut: 130, spanIn: 98 })

const DIAGONAL =
  'M10.06 5.25A3.4 3.4 0 0 0 5.25 10.06Q8.18 15.82 13.94 18.75A3.4 3.4 0 0 0 18.75 13.94Q7.33 16.67 10.06 5.25Z'

const CANDIDATES: { label: string; glyph: Glyph }[] = [
  { label: 'now', glyph: HangupGlyph },
  { label: 'diagonal', glyph: filled(DIAGONAL) },
  { label: 'arch plain', glyph: filled(UNIFORM) },
  { label: 'arch pads', glyph: filled(FLARED) },
  { label: 'arch thin bar', glyph: filled(FLARED_THIN) },
  { label: 'arch wider', glyph: filled(WIDER) },
  { label: 'arch outlined', glyph: outlined(UNIFORM) },
  { label: 'pads outlined', glyph: outlined(FLARED) }
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
