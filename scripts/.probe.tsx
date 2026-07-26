import { glyph } from '../src/renderer/src/components/glyph'
import { HangupGlyph, MicGlyph, CameraGlyph } from '../src/renderer/src/icons/media'
import { DesktopGlyph } from '../src/renderer/src/icons'
import * as doc from '../src/renderer/src/components/doc/docGlyphs'

type Mark = typeof HangupGlyph

const solid = (d: string) => glyph(<path d={d} fill="currentColor" />)
const mark = (art: React.ReactNode) => glyph(art, 2)

const HANG_B = solid(
  'M2.5 12.7C5.3 8.6 8.4 5.7 12 5.7s6.7 0 9.5 7C21.3 15.7 20 18.3 17.3 18.3 15.9 18.3 15.1 16.6 15.1 14.4V11.3C14.1 10.95 13.1 10.7 12 10.7S9.9 10.95 8.9 11.3v3.1C8.9 16.6 8.1 18.3 6.7 18.3 4 18.3 2.7 15.7 2.5 12.7Z'
)
const HANG_C = solid(
  'M2.5 12.7C5.3 8.6 8.4 5.7 12 5.7s6.7 2.9 9.5 7c-.2 3-1.5 5.6-4.2 5.6-1.6 0-2.6-1.6-2.6-3.9v-3.1c-1-.35-2-.6-2.7-.6s-1.7.25-2.7.6v3.1c0 2.3-1 3.9-2.6 3.9-2.7 0-4-2.6-4.2-5.6Z'
)
const HANG_D = solid(
  'M2.5 13.4C5.4 8.9 8.5 6.6 12 6.6s6.6 2.3 9.5 6.8c-.4 2.9-1.8 4.9-4.3 4.9-1.7 0-2.8-1.5-2.8-3.9v-2.6c-1-.3-1.9-.45-2.4-.45s-1.4.15-2.4.45v2.6c0 2.4-1.1 3.9-2.8 3.9-2.5 0-3.9-2-4.3-4.9Z'
)

const HANGUPS: [string, Mark][] = [
  ['A now', HangupGlyph],
  ['B', HANG_B],
  ['C', HANG_C],
  ['D', HANG_D]
]

function Bar({ Leave }: { Leave: Mark }) {
  const pill = (tone: string) => ({
    width: 40,
    height: 40,
    borderRadius: 999,
    background: tone === 'red' ? 'rgb(255 90 90 / 0.15)' : 'rgb(255 255 255 / 0.08)',
    color: tone === 'red' ? '#ff6b6b' : '#ffffffb3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  })
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={pill('')}>
        <MicGlyph className="w-[18px] h-[18px]" />
      </span>
      <span style={pill('')}>
        <CameraGlyph className="w-[18px] h-[18px]" />
      </span>
      <span style={pill('')}>
        <DesktopGlyph className="w-[18px] h-[18px]" />
      </span>
      <span style={{ width: 1, height: 24, background: '#ffffff14', margin: '0 4px' }} />
      <span style={pill('red')}>
        <Leave className="w-[18px] h-[18px]" />
      </span>
      <span style={pill('red')}>
        <Leave className="w-5 h-5" />
      </span>
    </span>
  )
}

// ---- doc candidates -------------------------------------------------------

const Pilcrow = mark(
  <>
    <path d="M13.4 5.5v13" />
    <path d="M17.8 5.5v13" />
    <path d="M13.4 12.9h-2.8a3.7 3.7 0 0 1 0-7.4h7.2" />
  </>
)
const IndentLines = mark(
  <>
    <path d="M8.6 6.2h11.4" />
    <path d="M4 11.4h16" />
    <path d="M4 16.6h11.4" />
  </>
)
const TextLines = mark(
  <>
    <path d="M4 6.2h16" />
    <path d="M4 11.4h16" />
    <path d="M4 16.6h9.6" />
  </>
)

const H = (numeral: React.ReactNode) =>
  mark(
    <>
      <path d="M3.8 6v12" />
      <path d="M11.4 6v12" />
      <path d="M3.8 12h7.6" />
      {numeral}
    </>
  )
const H1a = H(<path d="M19.6 18v-7.6l-2.2 1.8" strokeWidth={1.7} />)
const H2a = H(
  <path
    d="M15.5 12.3a2.2 2.2 0 1 1 4.4 0c0 1.7-4.4 3.3-4.4 5.7h4.6"
    strokeWidth={1.7}
  />
)
const H3a = H(
  <>
    <path d="M15.6 11.3a2.1 2.1 0 1 1 1.7 3.3h-.5" strokeWidth={1.7} />
    <path d="M16.8 14.6a2.1 2.1 0 1 1-1.3 3.4" strokeWidth={1.7} />
  </>
)

const QuoteBar = mark(
  <>
    <path d="M4.6 6v12" />
    <path d="M9.8 8.6h10.2" />
    <path d="M9.8 15.4h6.6" />
  </>
)
const QuoteMarks = mark(
  <>
    <path d="M9.4 15.2c-2.4 0-3.9-1.5-3.9-3.6 0-2 1.5-3.6 3.4-3.6 1.6 0 2.6 1 2.6 2.4 0 1.3-.9 2.3-2.2 2.3" />
    <path d="M18.6 15.2c-2.4 0-3.9-1.5-3.9-3.6 0-2 1.5-3.6 3.4-3.6 1.6 0 2.6 1 2.6 2.4 0 1.3-.9 2.3-2.2 2.3" />
  </>
)

const dot = (y: number) => <circle cx="5.1" cy={y} r="1.15" fill="currentColor" stroke="none" />
const LIST_Y = [6.4, 12, 17.6]
const Bullets = mark(
  <>
    {LIST_Y.map(y => (
      <g key={y}>{dot(y)}</g>
    ))}
    {LIST_Y.map(y => (
      <path key={y} d={`M9.6 ${y}h10.4`} />
    ))}
  </>
)

const Numbers = mark(
  <>
    <path d="M3.4 5.1 5 4.1v4.6" strokeWidth={1.7} />
    <path d="M3.3 10.7a1.5 1.5 0 1 1 3 0c0 1.2-3 2.2-3 3.7h3.2" strokeWidth={1.7} />
    <path d="M3.4 15.4h3.1l-1.5 1.8a1.6 1.6 0 1 1-1.4 2.4" strokeWidth={1.7} />
    {LIST_Y.map(y => (
      <path key={y} d={`M9.6 ${y}h10.4`} />
    ))}
  </>
)

const Todo2 = mark(
  <>
    <path d="m3.4 7.4 1.9 1.9 3.4-3.8" />
    <path d="m3.4 16.4 1.9 1.9 3.4-3.8" />
    <path d="M12.2 7.6H20" />
    <path d="M12.2 16.6H20" />
  </>
)
const Todo3 = mark(
  <>
    <path d="m3.3 6.3 1.5 1.5 2.7-3" />
    <path d="m3.3 11.9 1.5 1.5 2.7-3" />
    <path d="m3.3 17.5 1.5 1.5 2.7-3" />
    {LIST_Y.map(y => (
      <path key={y} d={`M11 ${y}h9`} />
    ))}
  </>
)

const Code2 = mark(
  <>
    <path d="m9 6.9-4.6 5.1 4.6 5.1" />
    <path d="m15 6.9 4.6 5.1-4.6 5.1" />
  </>
)
const Code3 = mark(
  <>
    <path d="m8.4 7.4-4.4 4.6 4.4 4.6" />
    <path d="m15.6 7.4 4.4 4.6-4.4 4.6" />
    <path d="m13.4 5.6-2.8 12.8" />
  </>
)

const Div1 = mark(<path d="M3.4 12h17.2" />)
const Div2 = mark(
  <>
    <path d="M3.4 12h17.2" />
    <path d="M7.6 6.4h8.8" />
    <path d="M7.6 17.6h8.8" />
  </>
)
const Div3 = mark(
  <>
    <path d="M3.4 12h5.4" />
    <path d="M15.2 12h5.4" />
    <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
  </>
)

const Table1 = mark(
  <>
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.8" />
    <path d="M3.4 9.6h17.2" />
    <path d="M12 9.6v10" />
  </>
)
const Table2 = mark(
  <>
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.8" />
    <path d="M3.4 9.6h17.2" />
    <path d="M12 4.4v15.2" />
  </>
)
const Table3 = mark(
  <>
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.8" />
    <path d="M3.4 9.6h17.2M3.4 14.6h17.2" />
    <path d="M12 9.6v10" />
  </>
)

const Image1 = mark(
  <>
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.8" />
    <circle cx="8.7" cy="9.6" r="1.15" fill="currentColor" stroke="none" />
    <path d="m4.2 18.2 4.8-4.4 3.4 3 2.8-2.4 5.4 4.6" />
  </>
)

const OPTIONS: [string, Mark[]][] = [
  ['Paragraph', [doc.ParagraphGlyph, TextLines, IndentLines, Pilcrow]],
  ['Heading 1', [doc.Heading1Glyph, H1a]],
  ['Heading 2', [doc.Heading2Glyph, H2a]],
  ['Heading 3', [doc.Heading3Glyph, H3a]],
  ['Quote', [doc.QuoteGlyph, QuoteBar, QuoteMarks]],
  ['Bulleted', [doc.BulletListGlyph, Bullets]],
  ['Numbered', [doc.NumberedListGlyph, Numbers]],
  ['To-do', [doc.TodoGlyph, Todo2, Todo3]],
  ['Code', [doc.CodeGlyph, Code2, Code3]],
  ['Divider', [doc.DividerGlyph, Div1, Div2, Div3]],
  ['Table', [doc.TableGlyph, Table1, Table2, Table3]],
  ['Image', [doc.ImageGlyph, Image1]]
]

function Menu({ title, pick }: { title: string; pick: (name: string, all: Mark[]) => Mark }) {
  return (
    <div
      style={{
        width: 250,
        background: '#1a1a1de6',
        border: '1px solid #ffffff14',
        borderRadius: 16,
        padding: 6
      }}
    >
      <p style={{ margin: '4px 10px 8px', fontSize: 11, color: '#ffffff73' }}>{title}</p>
      {OPTIONS.map(([name, all]) => {
        const M = pick(name, all)
        return (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              fontSize: 14
            }}
          >
            <span style={{ color: '#ffffff8c', display: 'flex' }}>
              <M className="w-4 h-4" />
            </span>
            <span>{name}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Probe() {
  return (
    <div>
      {HANGUPS.map(([name, M]) => (
        <div className="row" key={name}>
          <span className="cap">{name}</span>
          <Bar Leave={M} />
          <M className="w-12 h-12" />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 28 }}>
        <Menu title="now" pick={(_n, all) => all[0]} />
        <Menu title="new" pick={(_n, all) => all[1] ?? all[0]} />
        <Menu title="alt a" pick={(_n, all) => all[2] ?? all[1] ?? all[0]} />
        <Menu title="alt b" pick={(_n, all) => all[3] ?? all[2] ?? all[1] ?? all[0]} />
      </div>
    </div>
  )
}
