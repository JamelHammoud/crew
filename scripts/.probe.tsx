import { glyph } from '../src/renderer/src/components/glyph'
import { HangupGlyph } from '../src/renderer/src/icons/media'
import * as doc from '../src/renderer/src/components/doc/docGlyphs'

const solid = (d: string) => glyph(<path d={d} fill="currentColor" />)

// A: what ships now.
// B: the same arch, deeper, bells hanging further.
// C: a handset tilted onto its cradle, near square box.
// D: arch with a wider stance, bells flaring out past the crown.
const B = solid(
  'M2.5 13.6C5.4 9.2 8.6 7 12 7s6.6 2.2 9.5 6.6c-1.7 2.7-3.3 4-4.7 4-1.8 0-2.9-1.4-2.9-3.7v-2.6c-1.2-.4-2.4-.6-3.9-.6s-2.7.2-3.9.6v2.6c0 2.3-1.1 3.7-2.9 3.7-1.4 0-3-1.3-4.7-4Z'
)
const C = solid(
  'M4.6 19.4C1.4 16.2 1.4 11 4.6 7.8s8.4-3.2 11.6 0l-2.2 2.2c-1 1-2.3 1-3.2.1l-1.2 1.2c-.6.6-.6 1.6 0 2.2l2.9 2.9c.6.6 1.6.6 2.2 0l1.2-1.2c-.9-.9-.9-2.2.1-3.2l2.2-2.2c3.2 3.2 3.2 8.4 0 11.6s-8.4 3.2-11.6 0Z'
)
const D = solid(
  'M2.4 14.2C5.6 9.4 8.8 7 12 7s6.4 2.4 9.6 7.2c-1.9 2.5-3.6 3.8-5.1 3.8-1.9 0-2.9-1.4-2.9-4.1v-2c-1-.3-2-.4-3.6-.4s-2.6.1-3.6.4v2c0 2.7-1 4.1-2.9 4.1-1.5 0-3.2-1.3-5.1-3.8Z'
)

const HANGUPS: [string, typeof HangupGlyph][] = [
  ['A now', HangupGlyph],
  ['B deeper', B],
  ['C tilted', C],
  ['D stance', D]
]

function Leave({ Mark, size }: { Mark: typeof HangupGlyph; size: number }) {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        background: 'rgb(255 90 90 / 0.15)',
        color: '#ff6b6b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Mark className={`w-[${size}px] h-[${size}px]`} />
    </span>
  )
}

const ROWS: [string, string, string?][] = [
  ['TEXT', ''],
  ['ParagraphGlyph', 'Paragraph', '⌘⌥0'],
  ['Heading1Glyph', 'Heading 1', '⌘⌥1'],
  ['Heading2Glyph', 'Heading 2', '⌘⌥2'],
  ['Heading3Glyph', 'Heading 3', '⌘⌥3'],
  ['QuoteGlyph', 'Quote'],
  ['LISTS', ''],
  ['BulletListGlyph', 'Bulleted list', '⌘⇧8'],
  ['NumberedListGlyph', 'Numbered list', '⌘⇧7'],
  ['TodoGlyph', 'To-do list', '⌘⇧9'],
  ['BLOCKS', ''],
  ['CodeGlyph', 'Code', '⌘⌥C'],
  ['DividerGlyph', 'Divider'],
  ['TableGlyph', 'Table'],
  ['ImageGlyph', 'Image']
]

function Menu() {
  const set = doc as unknown as Record<string, typeof HangupGlyph>
  return (
    <div
      style={{
        width: 260,
        background: '#1a1a1de6',
        border: '1px solid #ffffff14',
        borderRadius: 16,
        padding: 6
      }}
    >
      {ROWS.map(([key, title, keys]) => {
        const Mark = set[key]
        if (!Mark)
          return (
            <p
              key={key}
              style={{
                display: 'flex',
                height: 28,
                alignItems: 'center',
                padding: '0 8px',
                fontSize: 11,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '.04em',
                color: '#ffffff73',
                margin: 0
              }}
            >
              {key}
            </p>
          )
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 12,
              fontSize: 14
            }}
          >
            <span style={{ color: '#ffffff8c', display: 'flex' }}>
              <Mark className="w-4 h-4" />
            </span>
            <span style={{ flex: 1 }}>{title}</span>
            {keys && <span style={{ fontSize: 11, color: '#ffffff73' }}>{keys}</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function Probe() {
  return (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
      <div>
        {HANGUPS.map(([name, Mark]) => (
          <div className="row" key={name}>
            <span className="cap">{name}</span>
            {[16, 18, 20, 22].map(size => (
              <Leave key={size} Mark={Mark} size={size} />
            ))}
            <span style={{ color: '#ffffff8c', display: 'flex', marginLeft: 12 }}>
              <Mark className="w-4 h-4" />
            </span>
            <Mark className="w-12 h-12" />
          </div>
        ))}
      </div>
      <Menu />
    </div>
  )
}
