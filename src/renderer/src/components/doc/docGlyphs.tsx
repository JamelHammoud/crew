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
    <path d={`M13.3 13.6h-3a4 4 0 0 1 0-8h7.4`} />
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
    <path d="M19.6 18v-7.6l-2.2 1.8" strokeWidth={NUMERAL} />
  </>
)

export const Heading2Glyph = mark(
  <>
    {HEADING}
    <path d="M15.5 12.3a2.2 2.2 0 1 1 4.4 0c0 1.7-4.4 3.3-4.4 5.7h4.4" strokeWidth={NUMERAL} />
  </>
)

export const Heading3Glyph = mark(
  <>
    {HEADING}
    <path d="M15.6 11.3a2.1 2.1 0 1 1 1.7 3.3h-.5" strokeWidth={NUMERAL} />
    <path d="M16.8 14.6a2.1 2.1 0 1 1-1.3 3.4" strokeWidth={NUMERAL} />
  </>
)

// A rule with quoted text beside it. Two lines against a full height bar read as
// an equals sign that has lost its left end, because there is nothing above the
// first line or below the second for the bar to be holding.
export const QuoteGlyph = mark(
  <>
    <path d="M4.4 5.6v12.8" />
    {rows(9.6, 16.4)}
  </>
)

const bullet = (y: number) => <circle key={y} cx="5.1" cy={y} r="1.15" fill="currentColor" stroke="none" />

export const BulletListGlyph = mark(
  <>
    {ROWS.map(bullet)}
    {rows(9.6)}
  </>
)

// Each numeral is 3.8 tall and centred on the row it belongs to. Drawn any
// larger the three run into one another and the last one hangs below the line
// it is numbering, which is the only part of this the eye picks up at 16.
export const NumberedListGlyph = mark(
  <>
    <path d="M3.9 5.5 5.3 4.5v3.8" strokeWidth={NUMERAL} />
    <path d="M4 11.2a1.15 1.15 0 1 1 2.3 0c0 .9-2.3 1.65-2.3 2.75h2.5" strokeWidth={NUMERAL} />
    <path d="M4 15.8h2.6l-1.25 1.45a1.3 1.3 0 1 1-1.15 1.95" strokeWidth={NUMERAL} />
    {rows(9.6)}
  </>
)

// Two rows rather than three. A check is a turn where a bullet and a numeral are
// a single mark, and three of them down the side is a scribble at the size the
// menu wears. Two, drawn larger, is what carries the idea.
export const TodoGlyph = mark(
  <>
    <path d="m3.9 7.4 1.9 1.9 3.4-3.8" />
    <path d="m3.9 16.4 1.9 1.9 3.4-3.8" />
    <path d="M12.2 7.6H20" />
    <path d="M12.2 16.6H20" />
  </>
)

// The slash between the brackets, because a bare pair of chevrons is two thin
// marks with the middle of the box empty, and the middle is where the eye lands.
export const CodeGlyph = mark(
  <>
    <path d="m8.4 7.4-4.4 4.6 4.4 4.6" />
    <path d="m13.4 5.6-2.8 12.8" />
    <path d="m15.6 7.4 4.4 4.6-4.4 4.6" />
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

export const ImageGlyph = mark(
  <>
    <rect {...BLOCK} />
    <circle cx="8.7" cy="9.6" r="1.15" fill="currentColor" stroke="none" />
    <path d="m4.2 18.2 4.8-4.4 3.4 3 2.8-2.4 5.4 4.6" />
  </>
)

export const BoldGlyph = mark(
  <path d="M8 12h4.6a3.2 3.2 0 0 1 0 6.4H8V5.6h4.1a3.2 3.2 0 0 1 0 6.4" />
)

export const ItalicGlyph = mark(
  <>
    <path d="M15.6 5.8H9.8" />
    <path d="M14.2 18.2H8.4" />
    <path d="M13.4 5.8 10.6 18.2" />
  </>
)

export const UnderlineGlyph = mark(
  <>
    <path d="M6.8 5.4v6.2a5.2 5.2 0 0 0 10.4 0V5.4" />
    <path d="M6 18.6h12" />
  </>
)

export const StrikeGlyph = mark(
  <>
    <path d="M16 8.2a4.2 4.2 0 0 0-7.4 1.6c0 .9.5 1.6 1.4 2.2" />
    <path d="M8.4 16a4.2 4.2 0 0 0 7.4-1.6" />
    <path d="M4 12h16" />
  </>
)

export const LinkGlyph = mark(
  <>
    <path d="M10.6 13.4a3.9 3.9 0 0 0 5.6 0l2.4-2.5a3.9 3.9 0 0 0-5.5-5.5l-1.3 1.3" />
    <path d="M13.4 10.6a3.9 3.9 0 0 0-5.6 0l-2.4 2.5a3.9 3.9 0 0 0 5.5 5.5l1.3-1.3" />
  </>
)
