import { glyph } from '../src/renderer/src/components/glyph'
import type { Glyph } from '../src/renderer/src/components/glyph'
import { ImageGlyph as DocImage } from '../src/renderer/src/components/doc/docGlyphs'
import {
  BulletListGlyph,
  CodeGlyph,
  Heading1Glyph,
  NumberedListGlyph,
  ParagraphGlyph,
  QuoteGlyph,
  TodoGlyph
} from '../src/renderer/src/components/doc/docGlyphs'
import { PhotoGlyph } from '../src/renderer/src/icons'

const WEIGHT = 2
const mark = (art: Parameters<typeof glyph>[0]) => glyph(art, WEIGHT)

// Quote
const curl = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy}A${r} ${r} 0 0 0 ${cx - r} ${cy}A${r} ${r} 0 0 0 ${cx + r} ${cy}C${cx + r} ${cy + 1.9} ${cx + 0.6} ${cy + 3.1} ${cx - 1.5} ${cy + 3.9}`

const CurlQuote = mark(
  <>
    <path d={curl(8.7, 10.3, 2.3)} />
    <path d={curl(15.5, 10.3, 2.3)} />
  </>
)

const comma = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}C${cx + r} ${cy + 1.9} ${cx + 0.4} ${cy + 3.3} ${cx - 1.6} ${cy + 4.2}C${cx - 0.5} ${cy + 2.5} ${cx - r} ${cy + 1.4} ${cx - r} ${cy}Z`

const FilledQuote = mark(
  <>
    <path d={comma(8.8, 10.3, 2.2)} fill="currentColor" stroke="none" />
    <path d={comma(15.2, 10.3, 2.2)} fill="currentColor" stroke="none" />
  </>
)

const HookQuote = mark(
  <>
    <path d="M10.5 8.2a3.1 3.1 0 1 0-1.5 5.8" />
    <path d="M17.3 8.2a3.1 3.1 0 1 0-1.5 5.8" />
  </>
)

const PrimeQuote = mark(
  <>
    <path d="M10.3 7.7 8.4 13.8" />
    <path d="M16.6 7.7 14.7 13.8" />
  </>
)

// Numbered list
const NUMERAL = 1.7

const NumTaller = mark(
  <>
    <path d="M3.8 5.1 5.5 3.9v4.6" strokeWidth={1.85} />
    <path d="M3.9 10.8a1.35 1.35 0 1 1 2.7 0c0 1.05-2.7 2-2.7 3.3h2.9" strokeWidth={1.85} />
    <path d="M3.9 15.4h3l-1.45 1.7a1.5 1.5 0 1 1-1.35 2.3" strokeWidth={1.85} />
    <path d="M10.2 6.4H20M10.2 12H20M10.2 17.6h9.8" />
  </>
)

const NumTwoLight = mark(
  <>
    <path d="M3.6 6 5.7 4.6v5.6" strokeWidth={NUMERAL} />
    <path d="M3.7 15.2a1.7 1.7 0 1 1 3.4 0c0 1.3-3.4 2.5-3.4 4.2h3.7" strokeWidth={NUMERAL} />
    <path d="M10.6 7.6H20M10.6 16.6H20" />
  </>
)

const NumTwoBold = mark(
  <>
    <path d="M3.6 6 5.7 4.6v5.6" />
    <path d="M3.7 15.2a1.7 1.7 0 1 1 3.4 0c0 1.3-3.4 2.5-3.4 4.2h3.7" />
    <path d="M10.6 7.6H20M10.6 16.6H20" />
  </>
)

// Code
const CodeBare = mark(
  <>
    <path d="m8.4 7.4-4.4 4.6 4.4 4.6" />
    <path d="m15.6 7.4 4.4 4.6-4.4 4.6" />
  </>
)

const CodeTight = mark(
  <>
    <path d="m9.8 6.8-5 5.2 5 5.2" />
    <path d="m14.2 6.8 5 5.2-5 5.2" />
  </>
)

const CodeTighter = mark(
  <>
    <path d="m10.6 7-4.8 5 4.8 5" />
    <path d="m13.4 7 4.8 5-4.8 5" />
  </>
)

// Image
const BLOCK = { x: 3.4, y: 4.4, width: 17.2, height: 15.2, rx: 2.8 }
const SCREEN = { x: 2.5, y: 4.5, width: 19, height: 15, rx: 3 }

const ImageOnePeak = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="8.4" cy="9.2" r="1.5" />
    <path d="m4 18.2 5.6-5.6a1.6 1.6 0 0 1 2.3 0l6.4 6.4" />
  </>
)

const ImageTwoPeak = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="16" cy="9" r="1.5" />
    <path d="m3.8 17.6 4.6-5.2a1.5 1.5 0 0 1 2.3 0l4.2 4.8" />
    <path d="m13.4 19.4 3.2-3.4a1.5 1.5 0 0 1 2.2 0l1.6 1.7" />
  </>
)

const ImageLong = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="8.6" cy="9.4" r="1.6" />
    <path d="m20.2 15.6-3-3a1.7 1.7 0 0 0-2.4 0l-9 9" />
  </>
)

const PhotoOnePeak = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="8" cy="9.2" r="1.5" />
    <path d="m3 18 5.8-5.8a1.7 1.7 0 0 1 2.4 0l6.8 6.8" />
  </>
)

const PhotoTwoPeak = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="15.8" cy="9" r="1.5" />
    <path d="m2.9 17.4 4.6-5a1.6 1.6 0 0 1 2.3 0l4.4 4.8" />
    <path d="m13 19.3 3.4-3.5a1.6 1.6 0 0 1 2.3 0l1.8 1.8" />
  </>
)

const PhotoLong = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="8" cy="9.2" r="1.6" />
    <path d="m21 15.2-3.1-3.1a1.8 1.8 0 0 0-2.5 0L6.2 21" />
  </>
)

function Ladder({ rows, note }: { rows: { label: string; glyph: Glyph }[]; note: string }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(245,245,245,0.35)' }}>{note}</p>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
          <span style={{ width: 92, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{row.label}</span>
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

function Row({ mark: Mark, title }: { mark: Glyph; title: string }) {
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
      <span style={{ display: 'flex', color: 'rgba(245,245,245,0.55)' }}>
        <Mark className="w-4 h-4" />
      </span>
      <span style={{ flex: 1 }}>{title}</span>
    </div>
  )
}

function Menu({
  label,
  quote,
  numbered,
  code,
  image
}: {
  label: string
  quote: Glyph
  numbered: Glyph
  code: Glyph
  image: Glyph
}) {
  return (
    <div>
      <p style={{ margin: '0 0 8px 10px', fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</p>
      <div
        style={{
          width: 200,
          borderRadius: 16,
          padding: 6,
          background: 'rgba(28,29,32,0.72)',
          border: '1px solid rgba(245,245,245,0.08)'
        }}
      >
        <Row mark={ParagraphGlyph} title="Text" />
        <Row mark={Heading1Glyph} title="Heading 1" />
        <Row mark={quote} title="Quote" />
        <Row mark={BulletListGlyph} title="Bulleted list" />
        <Row mark={numbered} title="Numbered list" />
        <Row mark={TodoGlyph} title="To-do list" />
        <Row mark={code} title="Code" />
        <Row mark={image} title="Image" />
      </div>
    </div>
  )
}

export default function Probe() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
        <div>
          <Ladder
            note="quote"
            rows={[
              { label: 'now', glyph: QuoteGlyph },
              { label: 'curl', glyph: CurlQuote },
              { label: 'filled', glyph: FilledQuote },
              { label: 'hook', glyph: HookQuote },
              { label: 'prime', glyph: PrimeQuote }
            ]}
          />
          <Ladder
            note="numbered list"
            rows={[
              { label: 'now', glyph: NumberedListGlyph },
              { label: '3 rows taller', glyph: NumTaller },
              { label: '2 rows light', glyph: NumTwoLight },
              { label: '2 rows full', glyph: NumTwoBold }
            ]}
          />
          <Ladder
            note="code"
            rows={[
              { label: 'now', glyph: CodeGlyph },
              { label: 'bare', glyph: CodeBare },
              { label: 'tight', glyph: CodeTight },
              { label: 'tighter', glyph: CodeTighter }
            ]}
          />
        </div>
        <div>
          <Ladder
            note="image, doc weight"
            rows={[
              { label: 'now', glyph: DocImage },
              { label: 'one peak', glyph: ImageOnePeak },
              { label: 'two peaks', glyph: ImageTwoPeak },
              { label: 'long fall', glyph: ImageLong }
            ]}
          />
          <Ladder
            note="image, crew set"
            rows={[
              { label: 'now', glyph: PhotoGlyph },
              { label: 'one peak', glyph: PhotoOnePeak },
              { label: 'two peaks', glyph: PhotoTwoPeak },
              { label: 'long fall', glyph: PhotoLong }
            ]}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
        <Menu label="now" quote={QuoteGlyph} numbered={NumberedListGlyph} code={CodeGlyph} image={DocImage} />
        <Menu label="curl / 2 full / bare / one peak" quote={CurlQuote} numbered={NumTwoBold} code={CodeBare} image={ImageOnePeak} />
        <Menu label="filled / 3 taller / tight / two peaks" quote={FilledQuote} numbered={NumTaller} code={CodeTight} image={ImageTwoPeak} />
        <Menu label="hook / 2 light / tighter / long" quote={HookQuote} numbered={NumTwoLight} code={CodeTighter} image={ImageLong} />
        <Menu label="prime / 2 full / tight / one peak" quote={PrimeQuote} numbered={NumTwoBold} code={CodeTight} image={ImageOnePeak} />
      </div>
    </div>
  )
}
