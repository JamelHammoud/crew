import { glyph } from '../glyph'

const WEIGHT = 2

// A numeral standing beside a letter is a smaller drawing than the letter is, so
// it is drawn lighter as well. At the block weight the digits in a heading and
// down the side of a numbered list close up into a smudge.
const NUMERAL = 1.7

const mark = (art: Parameters<typeof glyph>[0]) => glyph(art, WEIGHT)

// The menu has three groups and it reads as three groups: the text blocks are
// letterforms, the lists are rows with a different marker down the side, and the
// blocks are objects. Six of these were a run of horizontal lines with something
// small in front, which is why nothing in it could be told apart at a glance.

// One cap height for every letter in the set, and one baseline under them. The
// pilcrow, the three headings and the marks the toolbar wears are the same face,
// so they are drawn to these two lines rather than each to its own. The family
// sits under the box keyline on purpose: a letter grown until it fills a 17 box
// towers over the row it is read in.
const CAP = 5.6
const BASE = 18.4
const MIDDLE = (CAP + BASE) / 2

// The rows a list is written on. Three where the marker is a dot, two where it
// is a drawing of its own: a numeral and a check both need the room, and three
// of either closes up at the size the menu wears.
const THREE = [6.4, 12, 17.6]
const PAIR = [7.6, 16.6]

const rows = (ys: number[], from: number) => (
  <>
    {ys.map(y => (
      <path key={y} d={`M${from} ${y}H20`} />
    ))}
  </>
)

// A pilcrow rather than three lines. It is the mark for a paragraph in every
// place text is set, it stands with the headings as a letterform rather than
// against them, and it is the one shape in the menu nothing else can be mistaken
// for.
export const ParagraphGlyph = mark(
  <>
    <path d={`M13.3 ${CAP}v12.8`} />
    <path d={`M17.7 ${CAP}v12.8`} />
    <path d="M13.3 13.6h-3a4 4 0 0 1 0-8h7.4" />
  </>
)

const HEADING = (
  <>
    <path d={`M3.8 ${CAP}v12.8`} />
    <path d={`M11.4 ${CAP}v12.8`} />
    <path d={`M3.8 ${MIDDLE}h7.6`} />
  </>
)

export const Heading1Glyph = mark(
  <>
    {HEADING}
    <path d="M19.6 18.4v-7.6l-2.2 1.8" strokeWidth={NUMERAL} />
  </>
)

export const Heading2Glyph = mark(
  <>
    {HEADING}
    <path d="M15.5 12.7a2.2 2.2 0 1 1 4.4 0c0 1.7-4.4 3.3-4.4 5.7h4.4" strokeWidth={NUMERAL} />
  </>
)

export const Heading3Glyph = mark(
  <>
    {HEADING}
    <path d="M15.6 11.7a2.1 2.1 0 1 1 1.7 3.3h-.5" strokeWidth={NUMERAL} />
    <path d="M16.8 15a2.1 2.1 0 1 1-1.3 3.4" strokeWidth={NUMERAL} />
  </>
)

// The quotation mark itself. A bar with lines beside it is what a quote block
// looks like on the page, but in a menu it is the same silhouette as the two
// lists two rows below it, and a marker with lines beside it is what a list is.
// Punctuation is solid in every face it is set in, so this is solid too: a
// counter that small closes up at 16 anyway, and filled it cannot smudge.
const comma = (cx: number, cy: number, r: number) =>
  [
    `M${cx - r} ${cy}`,
    `A${r} ${r} 0 0 1 ${cx + r} ${cy}`,
    `C${cx + r} ${cy + r * 0.86} ${cx + r * 0.18} ${cy + r * 1.5} ${cx - r * 0.73} ${cy + r * 1.9}`,
    `C${cx - r * 0.23} ${cy + r * 1.14} ${cx - r} ${cy + r * 0.64} ${cx - r} ${cy}`,
    'Z'
  ].join('')

// The bowl and the tail are both drawn off the radius, so the pair grows as one
// mark. Its own centre is a bowl's height above the bottom of the tail, which is
// where the y sits: punctuation hangs from the cap line when it is set in text,
// and a mark standing alone in a row is read against the middle of the row.
export const QuoteGlyph = mark(
  <>
    <path d={comma(8.6, 10.9, 2.5)} fill="currentColor" stroke="none" />
    <path d={comma(15.4, 10.9, 2.5)} fill="currentColor" stroke="none" />
  </>
)

const bullet = (y: number) => <circle key={y} cx="5.1" cy={y} r="1.15" fill="currentColor" stroke="none" />

export const BulletListGlyph = mark(
  <>
    {THREE.map(bullet)}
    {rows(THREE, 9.6)}
  </>
)

// Two rows, and the numerals drawn at the weight of the lines they number. Three
// of them was a column of 3.8 tall digits at a lighter weight, and a digit that
// small is a smudge rather than a number: it is the one marker in the menu that
// has to be read as what it is.
export const NumberedListGlyph = mark(
  <>
    <path d="M4 6.2 6.1 4.8v5.6" />
    <path d="M4.1 15.3a1.7 1.7 0 1 1 3.4 0c0 1.3-3.4 2.5-3.4 4.2h3.7" />
    {rows(PAIR, 10.6)}
  </>
)

// A check is a turn where a bullet is a dot, so it stands on the pair of rows
// rather than the three. Three of them down the side is a scribble at the size
// the menu wears.
export const TodoGlyph = mark(
  <>
    <path d="m3.9 7.4 1.9 1.9 3.4-3.8" />
    <path d="m3.9 16.4 1.9 1.9 3.4-3.8" />
    {rows(PAIR, 12.2)}
  </>
)

// Two chevrons and nothing between them. They are drawn closer together than a
// pair of brackets would sit, because the middle of the box is where the eye
// lands and a wide gap there reads as two marks rather than one. Closer still
// and the two turn into a diamond at 16.
export const CodeGlyph = mark(
  <>
    <path d="m9.8 6.8-5 5.2 5 5.2" />
    <path d="m14.2 6.8 5 5.2-5 5.2" />
  </>
)

// The rule itself, and nothing else. A line between two faded ones was a third
// stack of stripes in a menu that already had five, and it read as an equals
// sign. Alone it is the only single stroke in the set, which is what makes it
// the easiest row in the menu to find.
export const DividerGlyph = mark(<path d="M4.5 12h15" />)

const BLOCK = { x: 3.4, y: 4.4, width: 17.2, height: 15.2, rx: 2.8 }

export const TableGlyph = mark(
  <>
    <rect {...BLOCK} />
    <path d="M3.4 9.6h17.2" />
    <path d="M12 4.4v15.2" />
  </>
)

export const TableHeaderGlyph = mark(
  <>
    <rect {...BLOCK} />
    <path d="M3.4 9.6h17.2" />
    <path d="M12 9.6v10" />
    <path d="M3.4 9.6V7.2a2.8 2.8 0 0 1 2.8-2.8h11.6a2.8 2.8 0 0 1 2.8 2.8v2.4Z" fill="currentColor" stroke="none" />
  </>
)

// Where the words sit in a column, which is a different question from where a
// shape sits on a canvas, so these are not the design set's align marks: those
// are a bar with two rects pushed against it, and they say align to that edge.
// These say the type is ragged on that side. Three rows on the set's own
// spacing with the middle one short, so the ragged edge is the whole of what
// tells the three apart, and the full rows are the bare line's own 15.
const FULL = 'M4.5 %yH19.5'
const align = (short: string) =>
  mark(
    <>
      <path d={FULL.replace('%y', '6.4')} />
      <path d={short} />
      <path d={FULL.replace('%y', '17.6')} />
    </>
  )

export const AlignTextLeftGlyph = align('M4.5 12H14')
export const AlignTextCenterGlyph = align('M7.25 12h9.5')
export const AlignTextRightGlyph = align('M10 12h9.5')

// One hill, and it runs off the frame at both ends rather than standing inside
// it: a picture is a view of something larger, and a peak that stops short of
// the edges reads as a triangle in a box. The three peaks it had before were a
// zigzag at 16. Both ends land on the frame's own stroke, which is what hides
// the round caps.
export const ImageGlyph = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="16.2" cy="9" r="1.45" fill="currentColor" stroke="none" />
    <path d="M3.4 16.9l4.6-4.6a1.7 1.7 0 0 1 2.4 0l7.3 7.3" />
  </>
)

export const BoldGlyph = mark(<path d={`M8 ${MIDDLE}h4.6a3.2 3.2 0 0 1 0 6.4H8V${CAP}h4.1a3.2 3.2 0 0 1 0 6.4`} />)

export const ItalicGlyph = mark(
  <>
    <path d={`M15.6 ${CAP}H9.8`} />
    <path d={`M14.2 ${BASE}H8.4`} />
    <path d={`M13.4 ${CAP} 10.6 ${BASE}`} />
  </>
)

// The letter is shorter than the rest of the family, because the rule under it
// stands on the baseline and the two cannot share it. Held to the cap line and
// the rule's own stroke closes the gap between them.
export const UnderlineGlyph = mark(
  <>
    <path d={`M6.5 ${CAP}v5.6a5.5 5.5 0 0 0 11 0V${CAP}`} />
    <path d="M5 19.25h14" />
  </>
)

export const StrikeGlyph = mark(
  <>
    <path d="M16.4 7.8a4.6 4.6 0 0 0-8.14 1.76c0 .99.55 1.76 1.54 2.42" />
    <path d="M8 16.4a4.6 4.6 0 0 0 8.14-1.76" />
    <path d={`M4 ${MIDDLE}h16`} />
  </>
)

export const LinkGlyph = mark(
  <>
    <path d="M10.45 13.55a4.33 4.33 0 0 0 6.22 0l2.66-2.78a4.33 4.33 0 0 0-6.11-6.11l-1.44 1.44" />
    <path d="M13.55 10.45a4.33 4.33 0 0 0-6.22 0l-2.66 2.78a4.33 4.33 0 0 0 6.11 6.11l1.44-1.44" />
  </>
)
