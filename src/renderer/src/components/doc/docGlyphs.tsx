import { glyph } from '../glyph'

const WEIGHT = 2

const mark = (art: Parameters<typeof glyph>[0]) => glyph(art, WEIGHT)

export const ParagraphGlyph = mark(
  <>
    <path d="M4 6.8h16" />
    <path d="M4 12h16" />
    <path d="M4 17.2h9.5" />
  </>
)

export const Heading1Glyph = mark(
  <>
    <path d="M4 6.6v10.8" />
    <path d="M11.2 6.6v10.8" />
    <path d="M4 12h7.2" />
    <path d="M19.4 17.4v-7.2l-2 1.7" />
  </>
)

export const Heading2Glyph = mark(
  <>
    <path d="M4 6.6v10.8" />
    <path d="M11.2 6.6v10.8" />
    <path d="M4 12h7.2" />
    <path d="M15.6 12.3a2.1 2.1 0 1 1 4.2 0c0 1.6-4.2 3.1-4.2 5.1h4.4" />
  </>
)

export const Heading3Glyph = mark(
  <>
    <path d="M4 6.6v10.8" />
    <path d="M11.2 6.6v10.8" />
    <path d="M4 12h7.2" />
    <path d="M15.7 11.4a2 2 0 1 1 1.6 3.2h-.6" />
    <path d="M16.7 14.6a2 2 0 1 1-1.2 3.2" />
  </>
)

export const QuoteGlyph = mark(
  <>
    <path d="M5.2 6.6v10.8" />
    <path d="M10.4 9.4h9.6" />
    <path d="M10.4 14.6h6" />
  </>
)

export const BulletListGlyph = mark(
  <>
    <path d="M5 6.8h.01" />
    <path d="M5 12h.01" />
    <path d="M5 17.2h.01" />
    <path d="M10 6.8h10" />
    <path d="M10 12h10" />
    <path d="M10 17.2h10" />
  </>
)

export const NumberedListGlyph = mark(
  <>
    <path d="M4.1 5.6 5.6 4.7v4.6" strokeWidth={1.6} />
    <path d="M3.9 11.4a1.4 1.4 0 1 1 2.8 0c0 1.1-2.8 2-2.8 3.4h2.9" strokeWidth={1.6} />
    <path d="M3.9 16.6a1.3 1.3 0 1 1 1.1 2.1h-.4" strokeWidth={1.6} />
    <path d="M4.6 18.7a1.3 1.3 0 1 1-.8 2.1" strokeWidth={1.6} />
    <path d="M10 6.8h10" />
    <path d="M10 13.2h10" />
    <path d="M10 19.4h10" />
  </>
)

export const TodoGlyph = mark(
  <>
    <path d="m3.6 7 1.7 1.7 3.1-3.4" />
    <path d="m3.6 15.5 1.7 1.7 3.1-3.4" />
    <path d="M11.8 7.2H20" />
    <path d="M11.8 15.7H20" />
  </>
)

export const CodeGlyph = mark(
  <>
    <path d="m9.2 8.2-4.4 3.8 4.4 3.8" />
    <path d="m14.8 8.2 4.4 3.8-4.4 3.8" />
  </>
)

export const DividerGlyph = mark(
  <>
    <path d="M4 12h16" />
    <path d="M7 6.6h10" strokeWidth={1.4} strokeOpacity={0.45} />
    <path d="M7 17.4h10" strokeWidth={1.4} strokeOpacity={0.45} />
  </>
)

export const TableGlyph = mark(
  <>
    <rect x="3.6" y="4.8" width="16.8" height="14.4" rx="2.6" />
    <path d="M3.6 9.8h16.8" />
    <path d="M12 9.8v9.4" />
  </>
)

export const ImageGlyph = mark(
  <>
    <rect x="3.6" y="4.8" width="16.8" height="14.4" rx="2.6" />
    <path d="M8.8 10.4h.01" />
    <path d="m4.4 17.6 4.4-4 3.2 2.8 2.6-2.2 4.9 4.2" />
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

export const AddGlyph = mark(
  <>
    <path d="M12 5.6v12.8" />
    <path d="M5.6 12h12.8" />
  </>
)

export const GripGlyph = glyph(
  <>
    <path d="M9.2 6.6h.01" />
    <path d="M14.8 6.6h.01" />
    <path d="M9.2 12h.01" />
    <path d="M14.8 12h.01" />
    <path d="M9.2 17.4h.01" />
    <path d="M14.8 17.4h.01" />
  </>,
  2.6
)
