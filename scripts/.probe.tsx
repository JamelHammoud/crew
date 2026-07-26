import type { Glyph } from '../src/renderer/src/components/glyph'
import {
  BoldGlyph,
  BulletListGlyph,
  CodeGlyph,
  DividerGlyph,
  Heading1Glyph,
  Heading2Glyph,
  Heading3Glyph,
  ImageGlyph,
  ItalicGlyph,
  LinkGlyph,
  NumberedListGlyph,
  ParagraphGlyph,
  QuoteGlyph,
  StrikeGlyph,
  TableGlyph,
  TodoGlyph,
  UnderlineGlyph
} from '../src/renderer/src/components/doc/docGlyphs'

const BLOCKS: { group: string; rows: { mark: Glyph; title: string; hint?: string }[] }[] = [
  {
    group: 'Text',
    rows: [
      { mark: ParagraphGlyph, title: 'Text', hint: '⌘⌥0' },
      { mark: Heading1Glyph, title: 'Heading 1', hint: '⌘⌥1' },
      { mark: Heading2Glyph, title: 'Heading 2', hint: '⌘⌥2' },
      { mark: Heading3Glyph, title: 'Heading 3', hint: '⌘⌥3' },
      { mark: QuoteGlyph, title: 'Quote' }
    ]
  },
  {
    group: 'Lists',
    rows: [
      { mark: BulletListGlyph, title: 'Bulleted list', hint: '⌘⇧8' },
      { mark: NumberedListGlyph, title: 'Numbered list', hint: '⌘⇧7' },
      { mark: TodoGlyph, title: 'To-do list', hint: '⌘⇧9' }
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

const FORMAT: { mark: Glyph; title: string }[] = [
  { mark: BoldGlyph, title: 'Bold' },
  { mark: ItalicGlyph, title: 'Italic' },
  { mark: UnderlineGlyph, title: 'Underline' },
  { mark: StrikeGlyph, title: 'Strike' },
  { mark: CodeGlyph, title: 'Code' },
  { mark: LinkGlyph, title: 'Link' }
]

const ALL = BLOCKS.flatMap(group => group.rows)

function Menu({ tint }: { tint: string }) {
  return (
    <div
      style={{
        width: 248,
        borderRadius: 16,
        padding: 6,
        background: 'rgba(28,29,32,0.72)',
        border: '1px solid rgba(245,245,245,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.55)'
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
          {group.rows.map((row, at) => (
            <div
              key={row.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 12,
                fontSize: 13,
                background: at === 0 && group.group === 'Text' ? 'rgba(245,245,245,0.08)' : 'transparent',
                color:
                  at === 0 && group.group === 'Text' ? '#f5f5f5' : 'rgba(245,245,245,0.7)'
              }}
            >
              <row.mark className="w-4 h-4" style={{ color: tint }} />
              <span style={{ flex: 1 }}>{row.title}</span>
              {row.hint && <span style={{ fontSize: 11, color: 'rgba(245,245,245,0.45)' }}>{row.hint}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Strip({ size, label }: { size: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      <span style={{ width: 66, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</span>
      {ALL.map(row => (
        <row.mark key={row.title} className={size} />
      ))}
    </div>
  )
}

export default function Probe() {
  return (
    <div style={{ display: 'flex', gap: 36, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <Menu tint="rgba(245,245,245,0.55)" />
        <Menu tint="#f5f5f5" />
      </div>
      <div style={{ flex: 1 }}>
        <Strip size="w-12 h-12" label="48" />
        <Strip size="w-6 h-6" label="24" />
        <Strip size="w-5 h-5" label="20" />
        <Strip size="w-4 h-4" label="16" />
        <div style={{ height: 1, background: 'rgba(245,245,245,0.1)', margin: '20px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <span style={{ width: 66, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>toolbar</span>
          {FORMAT.map(row => (
            <row.mark key={row.title} className="w-4 h-4" />
          ))}
          {FORMAT.map(row => (
            <row.mark key={`${row.title}-big`} className="w-12 h-12" />
          ))}
        </div>
      </div>
    </div>
  )
}
