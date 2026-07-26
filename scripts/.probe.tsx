import { glyph } from '../src/renderer/src/components/glyph'
import { HangupGlyph, MicGlyph, CameraGlyph } from '../src/renderer/src/icons/media'
import { DesktopGlyph } from '../src/renderer/src/icons'
import * as doc from '../src/renderer/src/components/doc/docGlyphs'

type Mark = typeof HangupGlyph

const solid = (d: string) => glyph(<path d={d} fill="currentColor" />)
const mark = (art: React.ReactNode) => glyph(art, 2)

const C1 = solid(
  'M2.5 12.7C5.3 8.6 8.4 5.7 12 5.7s6.7 2.9 9.5 7c-.2 3-1.5 5.6-4.2 5.6-1.6 0-2.6-1.6-2.6-3.9v-3.1c-1-.35-2-.6-2.7-.6s-1.7.25-2.7.6v3.1c0 2.3-1 3.9-2.6 3.9-2.7 0-4-2.6-4.2-5.6Z'
)
// Bells flaring wider than the crown, the way a handset's caps do.
const C2 = solid(
  'M3.5 11.6C6.1 7.7 8.9 5.7 12 5.7s5.9 2 8.5 5.9c.7 1.1 1 2.1 1 3 0 2.1-1.6 3.7-3.8 3.7-2 0-3.3-1.4-3.3-3.6v-2.9c-.8-.3-1.5-.4-2.4-.4s-1.6.1-2.4.4v2.9c0 2.2-1.3 3.6-3.3 3.6-2.2 0-3.8-1.6-3.8-3.7 0-.9.3-1.9 1-3Z'
)
// The same as C2, with the grip thinner so the notch under it opens up.
const C3 = solid(
  'M3.5 11.2C6.1 7.4 8.9 5.4 12 5.4s5.9 2 8.5 5.8c.7 1.1 1 2.2 1 3.2 0 2.2-1.6 3.8-3.8 3.8-2 0-3.3-1.5-3.3-3.7v-2.9c-.8-.3-1.5-.4-2.4-.4s-1.6.1-2.4.4v2.9c0 2.2-1.3 3.7-3.3 3.7-2.2 0-3.8-1.6-3.8-3.8 0-1 .3-2.1 1-3.2Z'
)

const HANGUPS: [string, Mark][] = [
  ['A now', HangupGlyph],
  ['C1', C1],
  ['C2 flared', C2],
  ['C3 thin grip', C3]
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
      <span style={{ color: '#ffffff8c', display: 'flex', marginLeft: 10 }}>
        <Leave className="w-4 h-4" />
      </span>
    </span>
  )
}

// ---- doc set --------------------------------------------------------------

const Pilcrow = mark(
  <>
    <path d="M13.4 5.5v13" />
    <path d="M17.8 5.5v13" />
    <path d="M13.4 12.9h-2.8a3.7 3.7 0 0 1 0-7.4h7.2" />
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
const H2a = H(<path d="M15.5 12.3a2.2 2.2 0 1 1 4.4 0c0 1.7-4.4 3.3-4.4 5.7h4.6" strokeWidth={1.7} />)
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
// A pair of opening quotes, drawn solid so the counter cannot close at 16.
const comma = (x: number) =>
  `M${x} 15.6c2.6-.5 4.2-2.1 4.2-4.4V6.4h-5.6v5.3h2.6c0 1.3-.7 2-2.2 2.3Z`
const QuoteSolid = glyph(
  <path d={`${comma(5.2)}${comma(14.4)}`} fill="currentColor" strokeWidth={0} />
)
const QuoteBar2 = mark(
  <>
    <path d="M4.4 5.6v12.8" />
    <path d="M9.6 8.2h10.4" />
    <path d="M9.6 12h10.4" />
    <path d="M9.6 15.8h6.4" />
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
const Code3 = mark(
  <>
    <path d="m8.4 7.4-4.4 4.6 4.4 4.6" />
    <path d="m15.6 7.4 4.4 4.6-4.4 4.6" />
    <path d="m13.4 5.6-2.8 12.8" />
  </>
)
const Div1 = mark(<path d="M3.4 12h17.2" />)
const Table2 = mark(
  <>
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2.8" />
    <path d="M3.4 9.6h17.2" />
    <path d="M12 4.4v15.2" />
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
  ['Paragraph', [doc.ParagraphGlyph, Pilcrow, Pilcrow]],
  ['Heading 1', [doc.Heading1Glyph, H1a, H1a]],
  ['Heading 2', [doc.Heading2Glyph, H2a, H2a]],
  ['Heading 3', [doc.Heading3Glyph, H3a, H3a]],
  ['Quote', [doc.QuoteGlyph, QuoteBar, QuoteSolid, QuoteBar2]],
  ['Bulleted', [doc.BulletListGlyph, Bullets, Bullets]],
  ['Numbered', [doc.NumberedListGlyph, Numbers, Numbers]],
  ['To-do', [doc.TodoGlyph, Todo2, Todo2]],
  ['Code', [doc.CodeGlyph, Code3, Code3]],
  ['Divider', [doc.DividerGlyph, Div1, Div1]],
  ['Table', [doc.TableGlyph, Table2, Table2]],
  ['Image', [doc.ImageGlyph, Image1, Image1]]
]

function Menu({ title, at }: { title: string; at: number }) {
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
        const M = all[at] ?? all[all.length - 1]
        return (
          <div
            key={name}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', fontSize: 14 }}
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
        <Menu title="now" at={0} />
        <Menu title="new, quote bar" at={1} />
        <Menu title="new, quote solid" at={2} />
        <Menu title="new, quote 3 lines" at={3} />
      </div>
    </div>
  )
}
