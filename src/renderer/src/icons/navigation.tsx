import { glyph } from '../components/glyph'

// A chevron is an angle, not an arrowhead: two strokes at 90 degrees, and
// because two strokes carry almost no ink it runs wider than a square would.
export const ChevronDownGlyph = glyph(<path d="m5 8.5 7 7 7-7" />)

export const ChevronUpGlyph = glyph(<path d="m5 15.5 7-7 7 7" />)

export const ChevronRightGlyph = glyph(<path d="m8.5 5 7 7-7 7" />)

export const ChevronLeftGlyph = glyph(<path d="m15.5 5-7 7 7 7" />)

// An arrow keeps its head at two thirds of the shaft. Wider than that and it
// reads as a signpost, narrower and it reads as a stick.
export const ArrowUpGlyph = glyph(
  <>
    <path d="M12 20V4" />
    <path d="m6.5 9.5 5.5-5.5 5.5 5.5" />
  </>
)

export const ArrowDownGlyph = glyph(
  <>
    <path d="M12 4v16" />
    <path d="m6.5 14.5 5.5 5.5 5.5-5.5" />
  </>
)

export const ArrowRightGlyph = glyph(
  <>
    <path d="M4 12h16" />
    <path d="m14.5 6.5 5.5 5.5-5.5 5.5" />
  </>
)

export const ArrowLeftGlyph = glyph(
  <>
    <path d="M20 12H4" />
    <path d="m9.5 6.5-5.5 5.5 5.5 5.5" />
  </>
)

export const UndoGlyph = glyph(
  <>
    <path d="m9 3.65-4.75 4.75 4.75 4.75" />
    <path d="M4.25 8.4h9.5a6 6 0 0 1 0 12H7.75" />
  </>
)

export const RedoGlyph = glyph(
  <>
    <path d="m15 3.65 4.75 4.75-4.75 4.75" />
    <path d="M19.75 8.4h-9.5a6 6 0 0 0 0 12H16.25" />
  </>
)

export const ReplyGlyph = glyph(
  <>
    <path d="m9.5 4-7 6 7 6" />
    <path d="M2.5 10H12M12 10a9.5 10 0 0 1 9.5 10" />
  </>
)

export const ReplyAllGlyph = glyph(
  <>
    <path d="m10 4-6 6 6 6" />
    <path d="m14 4-6 6 6 6" />
    <path d="M8 10h4a8 10 0 0 1 8 10" />
  </>
)

export const ForwardGlyph = glyph(
  <>
    <path d="m14.5 4 7 6-7 6" />
    <path d="M21.5 10H12M12 10a9.5 10 0 0 0-9.5 10" />
  </>
)

export const ExternalLinkGlyph = glyph(
  <>
    <path d="M19 13.5v5A2.5 2.5 0 0 1 16.5 21h-11A2.5 2.5 0 0 1 3 18.5v-11A2.5 2.5 0 0 1 5.5 5h5" />
    <path d="M20.5 3.5 11.5 12.5" />
    <path d="M14 3.5h6.5V10" />
  </>
)

// The gap sits on the right and the bracket lands on the arc's own end, so the
// head is the line arriving rather than a mark parked beside it.
export const RefreshGlyph = glyph(
  <>
    <path d="M19.8 16.5A9 9 0 1 1 20.15 8.2" />
    <path d="M20.15 3.2v5h-5" />
  </>
)

export const UploadGlyph = glyph(
  <>
    <path d="M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />
    <path d="M12 15V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
  </>
)

export const DownloadGlyph = glyph(
  <>
    <path d="M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />
    <path d="M12 4v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
  </>
)

export const LeaveGlyph = glyph(
  <>
    <path d="M13.5 4.5H6A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h7.5" />
    <path d="M10 12h10.5" />
    <path d="m16.5 8 4 4-4 4" />
  </>
)
