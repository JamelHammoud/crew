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
import { FileGlyph, FolderGlyph, PhotoGlyph, SearchGlyph, TerminalGlyph, WindowGlyph } from '../src/renderer/src/icons'

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

const ALL = BLOCKS.flatMap(group => group.rows)

const FORMAT: Glyph[] = [BoldGlyph, ItalicGlyph, UnderlineGlyph, StrikeGlyph, CodeGlyph, LinkGlyph]

function Menu({ tint, selected }: { tint: string; selected: boolean }) {
  return (
    <div
      style={{
        width: 232,
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
          {group.rows.map((row, at) => {
            const lit = selected && at === 0 && group.group === 'Text'
            return (
              <div
                key={row.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 12,
                  fontSize: 13,
                  background: lit ? 'rgba(245,245,245,0.08)' : 'transparent',
                  color: lit ? '#f5f5f5' : 'rgba(245,245,245,0.7)'
                }}
              >
                <span style={{ display: 'flex', color: lit ? '#f5f5f5' : tint }}>
                  <row.mark className="w-4 h-4" />
                </span>
                <span style={{ flex: 1 }}>{row.title}</span>
                {row.hint && <span style={{ fontSize: 11, color: 'rgba(245,245,245,0.45)' }}>{row.hint}</span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Strip({ size, label }: { size: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 15 }}>
      <span style={{ width: 30, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</span>
      {ALL.map(row => (
        <row.mark key={row.title} className={size} />
      ))}
    </div>
  )
}

function Toolbar() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 5,
        borderRadius: 14,
        background: 'rgba(28,29,32,0.72)',
        border: '1px solid rgba(245,245,245,0.08)'
      }}
    >
      {FORMAT.map((Mark, at) => (
        <span
          key={at}
          style={{
            display: 'flex',
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            background: at === 0 ? 'rgba(245,245,245,0.08)' : 'transparent',
            color: at === 0 ? '#f5f5f5' : 'rgba(245,245,245,0.7)'
          }}
        >
          <Mark className="w-4 h-4" />
        </span>
      ))}
    </div>
  )
}

export default function Probe() {
  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 18 }}>
        <Menu tint="rgba(245,245,245,0.55)" selected />
        <Menu tint="#f5f5f5" selected={false} />
      </div>
      <div>
        <Strip size="w-12 h-12" label="48" />
        <Strip size="w-6 h-6" label="24" />
        <Strip size="w-5 h-5" label="20" />
        <Strip size="w-4 h-4" label="16" />
        <div style={{ height: 1, background: 'rgba(245,245,245,0.1)', margin: '22px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 22 }}>
          <Toolbar />
          <span style={{ display: 'flex', gap: 16 }}>
            {FORMAT.map((Mark, at) => (
              <Mark key={at} className="w-12 h-12" />
            ))}
          </span>
        </div>
        <div style={{ height: 1, background: 'rgba(245,245,245,0.1)', margin: '22px 0' }} />
        <p style={{ margin: '0 0 14px', fontSize: 11, color: 'rgba(245,245,245,0.35)' }}>
          the crew set: photo beside its neighbours, 16 and 20, then 48
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          <span style={{ display: 'flex', gap: 12, color: 'rgba(245,245,245,0.8)' }}>
            <FileGlyph className="w-4 h-4" />
            <FolderGlyph className="w-4 h-4" />
            <PhotoGlyph className="w-4 h-4" />
            <WindowGlyph className="w-4 h-4" />
            <TerminalGlyph className="w-4 h-4" />
            <SearchGlyph className="w-4 h-4" />
          </span>
          <span style={{ display: 'flex', gap: 14, color: 'rgba(245,245,245,0.8)' }}>
            <FileGlyph className="w-5 h-5" />
            <FolderGlyph className="w-5 h-5" />
            <PhotoGlyph className="w-5 h-5" />
            <WindowGlyph className="w-5 h-5" />
            <TerminalGlyph className="w-5 h-5" />
            <SearchGlyph className="w-5 h-5" />
          </span>
          <span style={{ display: 'flex', gap: 16 }}>
            <PhotoGlyph className="w-12 h-12" />
            <WindowGlyph className="w-12 h-12" />
            <TerminalGlyph className="w-12 h-12" />
          </span>
        </div>
      </div>
    </div>
  )
}
