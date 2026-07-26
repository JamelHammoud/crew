import { glyph } from '../src/renderer/src/components/glyph'
import type { Glyph } from '../src/renderer/src/components/glyph'
import {
  BulletListGlyph,
  Heading1Glyph,
  NumberedListGlyph,
  ParagraphGlyph,
  QuoteGlyph,
  TodoGlyph
} from '../src/renderer/src/components/doc/docGlyphs'

const WEIGHT = 2
const mark = (art: Parameters<typeof glyph>[0]) => glyph(art, WEIGHT)

const curl = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy}A${r} ${r} 0 0 0 ${cx - r} ${cy}A${r} ${r} 0 0 0 ${cx + r} ${cy}C${cx + r} ${cy + 1.9} ${cx + 0.6} ${cy + 3.1} ${cx - 1.5} ${cy + 3.9}`

const CurlQuote = mark(
  <>
    <path d={curl(8.7, 10.4, 2.3)} />
    <path d={curl(15.5, 10.4, 2.3)} />
  </>
)

const comma = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}C${cx + r} ${cy + 1.9} ${cx + 0.4} ${cy + 3.3} ${cx - 1.6} ${cy + 4.2}C${cx - 0.5} ${cy + 2.5} ${cx - r} ${cy + 1.4} ${cx - r} ${cy}Z`

const FilledQuote = mark(
  <>
    <path d={comma(8.8, 10.4, 2.2)} fill="currentColor" stroke="none" />
    <path d={comma(15.2, 10.4, 2.2)} fill="currentColor" stroke="none" />
  </>
)

const PrimeQuote = mark(
  <>
    <path d="M10.2 7.9 8.4 13.6" />
    <path d="M16.4 7.9 14.6 13.6" />
  </>
)

const HookQuote = mark(
  <>
    <path d="M10.4 8.4a3 3 0 1 0-1.4 5.6" />
    <path d="M17.2 8.4a3 3 0 1 0-1.4 5.6" />
  </>
)

const BarQuote = mark(
  <>
    <path d="M4.4 5.6v12.8" />
    <path d="M9.6 6.4H20M9.6 12H20M9.6 17.6h6.8" />
  </>
)

const NUMERAL = 1.7

const NumThree = mark(
  <>
    <path d="M3.9 5.5 5.3 4.5v3.8" strokeWidth={NUMERAL} />
    <path d="M4 11.2a1.15 1.15 0 1 1 2.3 0c0 .9-2.3 1.65-2.3 2.75h2.5" strokeWidth={NUMERAL} />
    <path d="M4 15.8h2.6l-1.25 1.45a1.3 1.3 0 1 1-1.15 1.95" strokeWidth={NUMERAL} />
    <path d="M9.6 6.4H20M9.6 12H20M9.6 17.6h10.4" />
  </>
)

const NumBigger = mark(
  <>
    <path d="M3.8 5.2 5.4 4v4.4" strokeWidth={NUMERAL} />
    <path d="M3.9 10.9a1.3 1.3 0 1 1 2.6 0c0 1-2.6 1.9-2.6 3.15h2.8" strokeWidth={NUMERAL} />
    <path d="M3.9 15.5h2.9l-1.4 1.6a1.45 1.45 0 1 1-1.3 2.2" strokeWidth={NUMERAL} />
    <path d="M9.9 6.4H20M9.9 12H20M9.9 17.6h10.1" />
  </>
)

const NumTwo = mark(
  <>
    <path d="M3.7 6 5.6 4.6v5.2" strokeWidth={NUMERAL} />
    <path d="M3.8 15.4a1.6 1.6 0 1 1 3.2 0c0 1.2-3.2 2.3-3.2 4h3.5" strokeWidth={NUMERAL} />
    <path d="M10.4 7.2H20M10.4 17H20" />
  </>
)

const CANDIDATES: { label: string; glyph: Glyph }[] = [
  { label: 'now', glyph: QuoteGlyph },
  { label: 'bar, shorter', glyph: BarQuote },
  { label: 'curl', glyph: CurlQuote },
  { label: 'filled', glyph: FilledQuote },
  { label: 'hook', glyph: HookQuote },
  { label: 'prime', glyph: PrimeQuote }
]

const NUMBERS: { label: string; glyph: Glyph }[] = [
  { label: 'now 3.8', glyph: NumberedListGlyph },
  { label: 'taller 4.4', glyph: NumBigger },
  { label: 'two rows', glyph: NumTwo }
]

function Ladder({ rows }: { rows: { label: string; glyph: Glyph }[] }) {
  return (
    <div>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
          <span style={{ width: 84, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{row.label}</span>
          <row.glyph className="w-12 h-12" />
          <row.glyph className="w-6 h-6" />
          <row.glyph className="w-5 h-5" />
          <row.glyph className="w-4 h-4" />
          <span style={{ display: 'flex', color: 'rgba(245,245,245,0.55)' }}>
            <row.glyph className="w-4 h-4" />
          </span>
        </div>
      ))}
    </div>
  )
}

function Row({ mark: Mark, title, tint }: { mark: Glyph; title: string; tint: string }) {
  return (
    <div
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
      <span style={{ display: 'flex', color: tint }}>
        <Mark className="w-4 h-4" />
      </span>
      <span style={{ flex: 1 }}>{title}</span>
    </div>
  )
}

function Menu({ quote, numbered, label }: { quote: Glyph; numbered: Glyph; label: string }) {
  const tint = 'rgba(245,245,245,0.55)'
  return (
    <div>
      <p style={{ margin: '0 0 8px 10px', fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</p>
      <div
        style={{
          width: 210,
          borderRadius: 16,
          padding: 6,
          background: 'rgba(28,29,32,0.72)',
          border: '1px solid rgba(245,245,245,0.08)'
        }}
      >
        <Row mark={ParagraphGlyph} title="Text" tint={tint} />
        <Row mark={Heading1Glyph} title="Heading 1" tint={tint} />
        <Row mark={quote} title="Quote" tint={tint} />
        <Row mark={BulletListGlyph} title="Bulleted list" tint={tint} />
        <Row mark={numbered} title="Numbered list" tint={tint} />
        <Row mark={TodoGlyph} title="To-do list" tint={tint} />
      </div>
    </div>
  )
}

export default function Probe() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 46, alignItems: 'flex-start', marginBottom: 32 }}>
        <Ladder rows={CANDIDATES} />
        <Ladder rows={NUMBERS} />
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <Menu label="now" quote={QuoteGlyph} numbered={NumberedListGlyph} />
        <Menu label="curl + taller" quote={CurlQuote} numbered={NumBigger} />
        <Menu label="filled + taller" quote={FilledQuote} numbered={NumBigger} />
        <Menu label="hook + two rows" quote={HookQuote} numbered={NumTwo} />
        <Menu label="prime + taller" quote={PrimeQuote} numbered={NumBigger} />
      </div>
    </div>
  )
}
