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

const NOW =
  'M3.5 11.6C6.1 7.7 8.9 5.7 12 5.7s5.9 2 8.5 5.9c.7 1.1 1 2.1 1 3 0 2.1-1.6 3.7-3.8 3.7-2 0-3.3-1.4-3.3-3.6v-2.9c-.8-.3-1.5-.4-2.4-.4s-1.6.1-2.4.4v2.9c0 2.2-1.3 3.6-3.3 3.6-2.2 0-3.8-1.6-3.8-3.7 0-.9.3-1.9 1-3Z'

const turned = (deg: number) => (
  <g transform={`rotate(${deg} 12 12)`}>
    <path d={NOW} fill="currentColor" stroke="none" />
  </g>
)

const Tilt135 = glyph(turned(135))
const Tilt45 = glyph(turned(45))
const Tilt225 = glyph(turned(225))

// A handset with its bells drawn deeper and the grip narrower, upright.
const Deeper = glyph(
  <path
    d="M3.2 11.2C6 7.1 8.9 5 12 5s6 2.1 8.8 6.2c.8 1.2 1.2 2.4 1.2 3.4 0 2.4-1.8 4.2-4.3 4.2-2.3 0-3.8-1.6-3.8-4.1v-2.6c-.9-.3-1.6-.4-1.9-.4s-1 .1-1.9.4v2.6c0 2.5-1.5 4.1-3.8 4.1C3.8 18.8 2 17 2 14.6c0-1 .4-2.2 1.2-3.4Z"
    fill="currentColor"
    stroke="none"
  />
)

// The handset, tilted, with the bells kept level so the mark reads as a phone
// lifted off the cradle rather than as a shape spun round.
const Lifted = glyph(
  <g transform="rotate(-38 12 12)">
    <path d={NOW} fill="currentColor" stroke="none" />
  </g>
)

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 18 }}>
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
      <Bar label="now" leave={HangupGlyph} />
      <Bar label="deeper bells" leave={Deeper} />
      <Bar label="lifted 38" leave={Lifted} />
      <Bar label="turned 45" leave={Tilt45} />
      <Bar label="turned 135" leave={Tilt135} />
      <Bar label="turned 225" leave={Tilt225} />
    </div>
  )
}
