import type { ReactNode } from 'react'
import { glyph } from '../src/renderer/src/components/glyph'
import type { Glyph } from '../src/renderer/src/components/glyph'
import {
  CameraGlyph,
  DesktopGlyph,
  ExpandGlyph,
  HangupGlyph,
  MicGlyph
} from '../src/renderer/src/icons'

const round = (n: number) => Math.round(n * 100) / 100

// A handset is two round ends and a waist between them. The ends are what say
// telephone, the waist is what stops it reading as a bean.
const handset = ({
  deg,
  gap,
  r,
  waist,
  shift,
  sweep
}: {
  deg: number
  gap: number
  r: number
  waist: number
  shift: number
  sweep: 0 | 1
}) => {
  const rad = (deg * Math.PI) / 180
  const u = [Math.cos(rad), Math.sin(rad)]
  const n = [u[1], -u[0]]
  const at = (p: number[], along: number, across: number) => [
    p[0] + u[0] * along + n[0] * across,
    p[1] + u[1] * along + n[1] * across
  ]
  const A = at([12, 12], -gap / 2, 0)
  const B = at([12, 12], gap / 2, 0)
  const P1 = at(A, 0, r)
  const P2 = at(A, 0, -r)
  const P3 = at(B, 0, -r)
  const P4 = at(B, 0, r)
  const midOut = at([12, 12], 0, -(shift + waist / 2))
  const midIn = at([12, 12], 0, waist / 2 - shift)
  const control = (p: number[], q: number[], mid: number[]) => [
    2 * mid[0] - (p[0] + q[0]) / 2,
    2 * mid[1] - (q[1] + p[1]) / 2
  ]
  const c1 = control(P2, P3, midOut)
  const c2 = control(P4, P1, midIn)
  const xy = (p: number[]) => `${round(p[0])} ${round(p[1])}`
  return [
    `M${xy(P1)}`,
    `A${r} ${r} 0 0 ${sweep} ${xy(P2)}`,
    `Q${xy(c1)} ${xy(P3)}`,
    `A${r} ${r} 0 0 ${sweep} ${xy(P4)}`,
    `Q${xy(c2)} ${xy(P1)}`,
    'Z'
  ].join('')
}

const solid = (d: string) => glyph(<path d={d} fill="currentColor" stroke="none" />)

const CANDIDATES: { label: string; glyph: Glyph }[] = [
  { label: 'now', glyph: HangupGlyph },
  { label: '45 sweep 0', glyph: solid(handset({ deg: 45, gap: 9.6, r: 3.2, waist: 2.8, shift: 0.7, sweep: 0 })) },
  { label: '45 sweep 1', glyph: solid(handset({ deg: 45, gap: 9.6, r: 3.2, waist: 2.8, shift: 0.7, sweep: 1 })) },
  { label: '45 waist 2.2', glyph: solid(handset({ deg: 45, gap: 9.6, r: 3.3, waist: 2.2, shift: 0.9, sweep: 1 })) },
  { label: '45 flat shift', glyph: solid(handset({ deg: 45, gap: 9.6, r: 3.2, waist: 2.6, shift: 0, sweep: 1 })) },
  { label: '135', glyph: solid(handset({ deg: 135, gap: 9.6, r: 3.2, waist: 2.4, shift: 0.8, sweep: 1 })) },
  { label: '135 sweep 0', glyph: solid(handset({ deg: 135, gap: 9.6, r: 3.2, waist: 2.4, shift: 0.8, sweep: 0 })) },
  { label: '60 long', glyph: solid(handset({ deg: 60, gap: 10.4, r: 3.1, waist: 2.4, shift: 0.9, sweep: 1 })) }
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
      <span style={{ width: 96, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</span>
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
