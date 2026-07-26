import { glyph } from '../src/renderer/src/components/glyph'
import type { Glyph } from '../src/renderer/src/components/glyph'
import {
  BulletListGlyph,
  DividerGlyph,
  Heading1Glyph,
  Heading2Glyph,
  Heading3Glyph,
  ImageGlyph as DocImage,
  ParagraphGlyph,
  TableGlyph,
  TodoGlyph
} from '../src/renderer/src/components/doc/docGlyphs'
import { FileGlyph, FolderGlyph, PhotoGlyph, SearchGlyph, TerminalGlyph } from '../src/renderer/src/icons'

const WEIGHT = 2
const mark = (art: Parameters<typeof glyph>[0]) => glyph(art, WEIGHT)

const comma = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}C${cx + r} ${cy + 1.9} ${cx + 0.4} ${cy + 3.3} ${cx - 1.6} ${cy + 4.2}C${cx - 0.5} ${cy + 2.5} ${cx - r} ${cy + 1.4} ${cx - r} ${cy}Z`

const Quote = mark(
  <>
    <path d={comma(8.8, 10.3, 2.2)} fill="currentColor" stroke="none" />
    <path d={comma(15.2, 10.3, 2.2)} fill="currentColor" stroke="none" />
  </>
)

const Numbered = mark(
  <>
    <path d="M3.6 6 5.7 4.6v5.6" />
    <path d="M3.7 15.2a1.7 1.7 0 1 1 3.4 0c0 1.3-3.4 2.5-3.4 4.2h3.7" />
    <path d="M10.6 7.6H20M10.6 16.6H20" />
  </>
)

const Code = mark(
  <>
    <path d="m9.8 6.8-5 5.2 5 5.2" />
    <path d="m14.2 6.8 5 5.2-5 5.2" />
  </>
)

const BLOCK = { x: 3.4, y: 4.4, width: 17.2, height: 15.2, rx: 2.8 }
const SCREEN = { x: 2.5, y: 4.5, width: 19, height: 15, rx: 3 }

const DocOne = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="16.2" cy="9" r="1.5" />
    <path d="M3.4 16.9l4.6-4.6a1.7 1.7 0 0 1 2.4 0l7 7" />
  </>
)

const DocTwo = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="16.4" cy="8.8" r="1.5" />
    <path d="M3.4 16.4l4.2-4.2a1.6 1.6 0 0 1 2.3 0l4.4 4.4" />
    <path d="m12.6 18.2 2.6-2.6a1.6 1.6 0 0 1 2.3 0l3.1 3.1" />
  </>
)

const DocSolid = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="16.2" cy="9" r="1.5" fill="currentColor" stroke="none" />
    <path d="M3.4 16.9l4.6-4.6a1.7 1.7 0 0 1 2.4 0l7 7" />
  </>
)

const PhotoOne = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="16" cy="9" r="1.6" />
    <path d="M2.5 16.6l4.9-4.9a1.8 1.8 0 0 1 2.5 0l7.8 7.8" />
  </>
)

const PhotoTwo = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="16.2" cy="8.8" r="1.6" />
    <path d="M2.5 16.1l4.4-4.4a1.7 1.7 0 0 1 2.4 0l4.7 4.7" />
    <path d="m12.3 17.9 2.8-2.8a1.7 1.7 0 0 1 2.4 0l3.5 3.5" />
  </>
)

const PhotoSolid = glyph(
  <>
    <rect {...SCREEN} />
    <circle cx="16" cy="9" r="1.6" fill="currentColor" stroke="none" />
    <path d="M2.5 16.6l4.9-4.9a1.8 1.8 0 0 1 2.5 0l7.8 7.8" />
  </>
)

function Row({ mark: Mark, title }: { mark: Glyph; title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
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

function Menu({ label, image }: { label: string; image: Glyph }) {
  return (
    <div>
      <p style={{ margin: '0 0 8px 10px', fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</p>
      <div
        style={{
          width: 196,
          borderRadius: 16,
          padding: 6,
          background: 'rgba(28,29,32,0.72)',
          border: '1px solid rgba(245,245,245,0.08)'
        }}
      >
        <Row mark={ParagraphGlyph} title="Text" />
        <Row mark={Heading1Glyph} title="Heading 1" />
        <Row mark={Heading2Glyph} title="Heading 2" />
        <Row mark={Heading3Glyph} title="Heading 3" />
        <Row mark={Quote} title="Quote" />
        <Row mark={BulletListGlyph} title="Bulleted list" />
        <Row mark={Numbered} title="Numbered list" />
        <Row mark={TodoGlyph} title="To-do list" />
        <Row mark={Code} title="Code" />
        <Row mark={DividerGlyph} title="Divider" />
        <Row mark={TableGlyph} title="Table" />
        <Row mark={image} title="Image" />
      </div>
    </div>
  )
}

function Ladder({ rows, note }: { rows: { label: string; glyph: Glyph }[]; note: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(245,245,245,0.35)' }}>{note}</p>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
          <span style={{ width: 74, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{row.label}</span>
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

function Beside({ image, label }: { image: Glyph; label: string }) {
  const Mark = image
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
      <span style={{ width: 74, fontSize: 11, color: 'rgba(245,245,245,0.4)' }}>{label}</span>
      <span style={{ display: 'flex', gap: 12, color: 'rgba(245,245,245,0.8)' }}>
        <FileGlyph className="w-4 h-4" />
        <FolderGlyph className="w-4 h-4" />
        <Mark className="w-4 h-4" />
        <TerminalGlyph className="w-4 h-4" />
        <SearchGlyph className="w-4 h-4" />
      </span>
      <span style={{ display: 'flex', gap: 14, color: 'rgba(245,245,245,0.8)' }}>
        <FileGlyph className="w-5 h-5" />
        <FolderGlyph className="w-5 h-5" />
        <Mark className="w-5 h-5" />
        <TerminalGlyph className="w-5 h-5" />
        <SearchGlyph className="w-5 h-5" />
      </span>
    </div>
  )
}

export default function Probe() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 30 }}>
        <Menu label="now" image={DocImage} />
        <Menu label="one peak" image={DocOne} />
        <Menu label="two peaks" image={DocTwo} />
        <Menu label="solid sun" image={DocSolid} />
      </div>
      <div style={{ display: 'flex', gap: 50, alignItems: 'flex-start' }}>
        <Ladder
          note="image, doc weight"
          rows={[
            { label: 'now', glyph: DocImage },
            { label: 'one peak', glyph: DocOne },
            { label: 'two peaks', glyph: DocTwo },
            { label: 'solid sun', glyph: DocSolid }
          ]}
        />
        <Ladder
          note="image, crew set"
          rows={[
            { label: 'now', glyph: PhotoGlyph },
            { label: 'one peak', glyph: PhotoOne },
            { label: 'two peaks', glyph: PhotoTwo },
            { label: 'solid sun', glyph: PhotoSolid }
          ]}
        />
      </div>
      <div style={{ marginTop: 10 }}>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(245,245,245,0.35)' }}>
          crew set, in a row with its neighbours
        </p>
        <Beside label="now" image={PhotoGlyph} />
        <Beside label="one peak" image={PhotoOne} />
        <Beside label="two peaks" image={PhotoTwo} />
        <Beside label="solid sun" image={PhotoSolid} />
      </div>
    </div>
  )
}
