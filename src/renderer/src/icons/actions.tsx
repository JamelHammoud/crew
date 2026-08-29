import { glyph } from '../components/glyph'

export const PlusGlyph = glyph(<path d="M12 4.5v15M4.5 12h15" />)

export const MinusGlyph = glyph(<path d="M4.5 12h15" />)

// A diagonal reads longer than the same stroke laid flat, so the cross runs 11
// where the plus runs 15. Both end up carrying about thirty units of ink.
export const CloseGlyph = glyph(<path d="m6.5 6.5 11 11M17.5 6.5 6.5 17.5" />)

export const CloseOthersGlyph = glyph(
  <>
    <rect x="3" y="12" width="10" height="8" rx="2" />
    <path d="m15 4 6 6M21 4l-6 6" />
  </>
)

// The short arm is a little under half the long one. Any shorter and the tick
// loses its foot, any longer and it turns into a corner.
export const CheckGlyph = glyph(<path d="m5 12.5 4.5 4.5L19 7" />)

export const PencilGlyph = glyph(
  <>
    <path d="M3.5 20.3 4.3 16.1 16.75 3.65a2.7 2.7 0 0 1 3.8 3.8L8.05 19.9Z" />
    <path d="m15 5.4 3.8 3.8" />
  </>
)

export const TrashGlyph = glyph(
  <>
    <path d="M4.25 6.75h15.5" />
    <path d="M9.15 6.75V5.1a1.5 1.5 0 0 1 1.5-1.5h2.7a1.5 1.5 0 0 1 1.5 1.5v1.65" />
    <path d="M6.1 6.75V17.85A2.6 2.6 0 0 0 8.7 20.45h6.6a2.6 2.6 0 0 0 2.6-2.6V6.75" />
  </>
)

export const SearchGlyph = glyph(
  <>
    <circle cx="10.75" cy="10.75" r="6.75" />
    <path d="m15.6 15.6 4.4 4.4" />
  </>
)

export const RegexGlyph = glyph(
  <>
    <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <path d="M15.5 4.5v15M9.5 8.25l12 7.5M21.5 8.25l-12 7.5" />
  </>
)

// Copying and duplicating are the one idea, so they are the one drawing. The
// sheet behind is an open corner rather than a second closed box: two full
// rectangles cross twice and the crossing is all you see at 16px.
export const CopyGlyph = glyph(
  <>
    <rect x="8" y="8" width="12" height="12" rx="3" />
    <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
  </>
)

// Paste is copy's square with the thing arriving into it, so the pair shares a
// body and differs by what is behind: a second sheet, or an arrow. The arrow
// comes in on the diagonal and stops outside the corner, which is what keeps it
// off the download tray, where a straight arrow drops into an open box.
export const PasteGlyph = glyph(
  <>
    <rect x="8" y="8" width="12" height="12" rx="3" />
    <path d="m3.25 3.25 5 5" />
    <path d="M8.25 4.5v3.75H4.5" />
  </>
)

export const ChecklistGlyph = glyph(
  <>
    <path d="m4 8 2 2 3.75-4.25" />
    <path d="M13 8h7" />
    <path d="m4 16.25 2 2 3.75-4.25" />
    <path d="M13 16.25h7" />
  </>
)

export const LinkGlyph = glyph(
  <>
    <path d="M10.4 13.6a4.1 4.1 0 0 0 5.9 0l2.5-2.6a4.1 4.1 0 0 0-5.8-5.8l-1.4 1.4" />
    <path d="M13.6 10.4a4.1 4.1 0 0 0-5.9 0l-2.5 2.6a4.1 4.1 0 0 0 5.8 5.8l1.4-1.4" />
  </>
)

export const AttachmentGlyph = glyph(
  <path d="m15.75 7.25-7.5 7.5a3.25 3.25 0 0 0 4.6 4.6l7-7a5.5 5.5 0 0 0-7.8-7.8l-7.5 7.5a7.75 7.75 0 0 0 10.95 10.95l5.25-5.25" />
)

export const SpamGlyph = glyph(
  <>
    <path d="M8.25 2.75h7.5l5.5 5.5v7.5l-5.5 5.5h-7.5l-5.5-5.5v-7.5Z" />
    <path d="M12 7.25v6" />
    <circle cx="12" cy="17" r="1.25" fill="currentColor" stroke="none" />
  </>
)

export const LabelGlyph = glyph(
  <>
    <path d="M3 6.75A2.25 2.25 0 0 1 5.25 4.5h8.5l7.75 7.5-7.75 7.5h-8.5A2.25 2.25 0 0 1 3 17.25Z" />
    <circle cx="7.25" cy="12" r="1.5" />
  </>
)

export const EyedropperGlyph = glyph(
  <>
    <path d="M15.7 3.6a3.3 3.3 0 0 1 4.6 4.6l-2.3 2.3-4.6-4.6Z" />
    <path d="m16.7 9.3-9.4 9.4-3.8 1.7 1.7-3.8 9.4-9.4" />
  </>
)

// The mark for a list of things you can do. Half its box is empty the way a
// triangle's is, so it takes the whole live area down the diagonal and still
// runs light. The waist bars are the same length either side, which is what
// keeps the two arms reading as one stroke folded rather than two shapes.
export const BoltGlyph = glyph(<path d="M15 2.6 5.5 13.2h5l-1.5 8.2 9.5-10.6h-5Z" />)

// Asking an agent, wherever it is asked from. One star rather than a big one
// with a small one beside it: the pair has no centre of its own, so it hangs off
// to a corner in every row it stands in, and at 16 the two run together anyway.
// Four points, each arm hollowed by the two beside it, on the circle keyline
// because that is the box it fills.
export const SparkGlyph = glyph(
  <path d="M12 2.75c1.09 4.24 5 8.16 9.25 9.25-4.24 1.09-8.16 5-9.25 9.25-1.09-4.24-5-8.16-9.25-9.25 4.24-1.09 8.16-5 9.25-9.25Z" />
)

export const HandoffGlyph = glyph(
  <>
    <circle cx="5.8" cy="5.8" r="2.6" />
    <circle cx="18.2" cy="18.2" r="2.6" />
    <path d="m9.75 9.75 4.5 4.5" />
    <path d="M11.25 14.25h3v-3" />
  </>
)

export const MenuGlyph = glyph(<path d="M4.5 7h15M4.5 12h15M4.5 17h15" />)

export const HandleGlyph = glyph(<path d="M4.5 9.5h15M4.5 14.5h15" />)

// Ellipsis dots are filled, because a 1.5 stroke ring at this size fills in on
// its own and reads as a smudge rather than as a circle.
const DOTS = [5.6, 12, 18.4]

export const MoreGlyph = glyph(
  <>
    {DOTS.map(cx => (
      <circle key={cx} cx={cx} cy={12} r={1.6} fill="currentColor" stroke="none" />
    ))}
  </>
)

export const MoreVerticalGlyph = glyph(
  <>
    {DOTS.map(cy => (
      <circle key={cy} cx={12} cy={cy} r={1.6} fill="currentColor" stroke="none" />
    ))}
  </>
)
