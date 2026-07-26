import type { Glyph } from '../src/renderer/src/components/glyph'
import {
  BulletListGlyph,
  CodeGlyph,
  DividerGlyph,
  Heading1Glyph,
  Heading2Glyph,
  Heading3Glyph,
  ImageGlyph,
  NumberedListGlyph,
  ParagraphGlyph,
  QuoteGlyph,
  TableGlyph,
  TodoGlyph
} from '../src/renderer/src/components/doc/docGlyphs'
import {
  CameraGlyph,
  DesktopGlyph,
  ExpandGlyph,
  HangupGlyph,
  MicGlyph,
  PhotoGlyph,
  SignalGlyph
} from '../src/renderer/src/icons'

const BLOCKS: { group: string; rows: { mark: Glyph; title: string }[] }[] = [
  {
    group: 'Text',
    rows: [
      { mark: ParagraphGlyph, title: 'Text' },
      { mark: Heading1Glyph, title: 'Heading 1' },
      { mark: Heading2Glyph, title: 'Heading 2' },
      { mark: Heading3Glyph, title: 'Heading 3' },
      { mark: QuoteGlyph, title: 'Quote' }
    ]
  },
  {
    group: 'Lists',
    rows: [
      { mark: BulletListGlyph, title: 'Bulleted list' },
      { mark: NumberedListGlyph, title: 'Numbered list' },
      { mark: TodoGlyph, title: 'To-do list' }
    ]
  },
  {
    group: 'Blocks',
    rows: [
      { mark: CodeGlyph, title: 'Code' },
      { mark: DividerGlyph, title: 'Divider' },
      { mark: TableGlyph, title: 'Table' },
      { mark: ImageGlyph, title: 'Image' }
    ]
  }
]

function Button({ mark: Mark, danger }: { mark: Glyph; danger?: boolean }) {
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
      <Mark className="w-[18px] h-[18px]" />
    </span>
  )
}

function Card() {
  return (
    <div
      style={{
        width: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 20,
        background: '#161719',
        border: '1px solid rgba(245,245,245,0.06)',
        fontSize: 13,
        color: '#f5f5f5'
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(245,245,245,0.08)',
          color: '#b3b3b3'
        }}
      >
        <HangupGlyph className="w-4 h-4" />
      </span>
      <span style={{ flex: 1 }}>
        Huddle ended
        <span style={{ display: 'block', fontSize: 11, color: '#8b8d91' }}>3 joined, 12 minutes</span>
      </span>
    </div>
  )
}

export default function Probe() {
  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 232,
          borderRadius: 16,
          padding: 6,
          background: 'rgba(28,29,32,0.72)',
          border: '1px solid rgba(245,245,245,0.08)'
        }}
      >
        {BLOCKS.map(group => (
          <div key={group.group}>
            <p
              style={{
                margin: 0,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'rgba(245,245,245,0.45)'
              }}
            >
              {group.group}
            </p>
            {group.rows.map(row => (
              <div
                key={row.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 12,
                  fontSize: 13,
                  color: 'rgba(245,245,245,0.7)'
                }}
              >
                <span style={{ display: 'flex', color: 'rgba(245,245,245,0.55)' }}>
                  <row.mark className="w-4 h-4" />
                </span>
                <span style={{ flex: 1 }}>{row.title}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <span
          style={{
            display: 'inline-flex',
            gap: 8,
            padding: 8,
            borderRadius: 999,
            background: 'rgba(28,29,32,0.72)',
            border: '1px solid rgba(245,245,245,0.08)',
            alignSelf: 'flex-start'
          }}
        >
          <Button mark={MicGlyph} />
          <Button mark={CameraGlyph} />
          <Button mark={DesktopGlyph} />
          <Button mark={ExpandGlyph} />
          <Button mark={HangupGlyph} danger />
        </span>
        <Card />
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', color: '#f5f5f5' }}>
          <HangupGlyph className="w-4 h-4" />
          <HangupGlyph className="w-5 h-5" />
          <HangupGlyph className="w-6 h-6" />
          <HangupGlyph className="w-12 h-12" />
          <SignalGlyph className="w-4 h-4" />
          <SignalGlyph className="w-12 h-12" />
          <PhotoGlyph className="w-4 h-4" />
          <PhotoGlyph className="w-12 h-12" />
        </div>
      </div>
    </div>
  )
}
