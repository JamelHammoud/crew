import { glyph } from './glyph'

export const ReadGlyph = glyph(
  <>
    <path d="M2.8 12c2-3.6 5.3-5.6 9.2-5.6s7.2 2 9.2 5.6c-2 3.6-5.3 5.6-9.2 5.6S4.8 15.6 2.8 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </>
)

export const EditGlyph = glyph(
  <>
    <path d="M4.6 19.4 5.3 15.8 15.9 5.2a2.3 2.3 0 0 1 3.2 3.2L8.5 19Z" />
    <path d="m14.4 6.7 3.2 3.2" />
  </>
)

export const NotebookGlyph = glyph(
  <>
    <path d="M12 6.8C10.3 5.3 7.9 4.5 4.8 4.5v12.7c3.1 0 5.5.8 7.2 2.3 1.7-1.5 4.1-2.3 7.2-2.3V4.5c-3.1 0-5.5.8-7.2 2.3Z" />
    <path d="M12 6.8v12.7" />
  </>
)

export const ShellGlyph = glyph(
  <>
    <path d="m4.2 5.5 7.8 6.5-7.8 6.5" />
    <path d="M14.3 18.5h5.5" />
  </>
)

export const OutputGlyph = glyph(<path d="M3.5 12h3.6l2.4-5.6 3.8 11.2 2.4-5.6h4.8" />)

export const StopGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <rect x="8.9" y="8.9" width="6.2" height="6.2" rx="1.6" />
  </>
)

export const SearchGlyph = glyph(
  <>
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="m15.7 15.7 4.8 4.8" />
  </>
)

export const FilesGlyph = glyph(
  <>
    <rect x="4.5" y="8" width="11" height="12.5" rx="2" />
    <path d="M8 8V5.5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2h-2" />
  </>
)

export const FolderGlyph = glyph(
  <path d="M3.5 17.5V6.8A1.8 1.8 0 0 1 5.3 5h3.3a1.8 1.8 0 0 1 1.3.6l1.1 1.2a1.8 1.8 0 0 0 1.3.6h6.4a1.8 1.8 0 0 1 1.8 1.8v8.3a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8Z" />
)

export const GlobeGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <ellipse cx="12" cy="12" rx="3.7" ry="8.5" />
    <path d="M3.6 12h16.8" />
  </>
)

export const PageGlyph = glyph(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17" />
  </>
)

export const PostsGlyph = glyph(
  <path d="M20 11.6c0 4.1-3.6 7.4-8 7.4a9.4 9.4 0 0 1-2.4-.3l-4.6 1.8 1.4-3.7A7.1 7.1 0 0 1 4 11.6c0-4.1 3.6-7.4 8-7.4s8 3.3 8 7.4Z" />
)

export const ChecklistGlyph = glyph(
  <>
    <path d="m4 8.2 2 2 3.6-4" />
    <path d="M13 8.2h7" />
    <path d="m4 16.2 2 2 3.6-4" />
    <path d="M13 16.2h7" />
  </>
)

export const ClipboardGlyph = glyph(
  <>
    <path d="M9 5.2H7.6A1.6 1.6 0 0 0 6 6.8v12.1a1.6 1.6 0 0 0 1.6 1.6h8.8a1.6 1.6 0 0 0 1.6-1.6V6.8a1.6 1.6 0 0 0-1.6-1.6H15" />
    <rect x="9" y="3.2" width="6" height="4" rx="1.5" />
  </>
)

export const SparkGlyph = glyph(
  <path d="M12 3.5c1 3.9 4.6 7.5 8.5 8.5-3.9 1-7.5 4.6-8.5 8.5-1-3.9-4.6-7.5-8.5-8.5 3.9-1 7.5-4.6 8.5-8.5Z" />
)

export const QuestionGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.7a2.5 2.5 0 0 1 4.9.5c0 1.7-2.5 2.1-2.5 3.6" />
    <path d="M12 16.3v.4" />
  </>
)

export const BoltGlyph = glyph(<path d="M13.3 3.5 5.8 13.2H11l-.3 7.3 7.5-9.7H13Z" />)

export const ImageGlyph = glyph(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="m3.8 16.3 4.9-4.9 3.6 3.6 2.6-2.6 4.8 4.8" />
    <circle cx="15.3" cy="9" r="1.5" />
  </>
)

export const VideoGlyph = glyph(
  <>
    <rect x="3" y="5.2" width="13" height="13.6" rx="2.5" />
    <path d="m16 11.1 4.2-2.9a.9.9 0 0 1 1.4.8v6a.9.9 0 0 1-1.4.8L16 12.9Z" />
  </>
)

export const BookmarkGlyph = glyph(
  <path d="M6.5 4.8A1.3 1.3 0 0 1 7.8 3.5h8.4a1.3 1.3 0 0 1 1.3 1.3v15.4a.7.7 0 0 1-1.1.55L12 17.2l-4.4 3.55a.7.7 0 0 1-1.1-.55Z" />
)

export const CHECK_PATH = 'm8.2 12.2 2.6 2.6 5-5.5'

export const DoneGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d={CHECK_PATH} />
  </>
)

export const PlaneGlyph = glyph(
  <>
    <path d="M20.5 3.5 3.5 10.1l7.3 2.6 2.6 7.3Z" />
    <path d="M10.8 12.7 20.5 3.5" />
  </>
)

export const BellGlyph = glyph(
  <>
    <path d="M6.3 10.6a5.7 5.7 0 0 1 11.4 0c0 3 .7 4.4 1.5 5.3.4.5.1 1.3-.6 1.3H5.4c-.7 0-1-.8-.6-1.3.8-.9 1.5-2.3 1.5-5.3Z" />
    <path d="M9.7 19.2a2.4 2.4 0 0 0 4.6 0" />
  </>
)

export const ClockGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.3V12l3.3 2" />
  </>
)

export const SignalGlyph = glyph(
  <>
    <path d="M6.2 17.8a8.2 8.2 0 0 1 0-11.6" />
    <path d="M17.8 6.2a8.2 8.2 0 0 1 0 11.6" />
    <circle cx="12" cy="12" r="2.4" />
  </>
)

export const FlowGlyph = glyph(
  <>
    <rect x="3.5" y="3.5" width="7.5" height="6.5" rx="2" />
    <rect x="13" y="14" width="7.5" height="6.5" rx="2" />
    <path d="M11 6.75h3.75a2 2 0 0 1 2 2V14" />
  </>
)

export const BranchGlyph = glyph(
  <>
    <circle cx="7" cy="5.8" r="2.6" />
    <circle cx="7" cy="18.2" r="2.6" />
    <circle cx="17" cy="5.8" r="2.6" />
    <path d="M7 8.4v7.2" />
    <path d="M17 8.4v2a4 4 0 0 1-4 4H7" />
  </>
)

export const CodeGlyph = glyph(
  <>
    <path d="M8.8 8.2 4.5 12l4.3 3.8" />
    <path d="M15.2 8.2 19.5 12l-4.3 3.8" />
    <path d="M13.6 5.5 10.4 18.5" />
  </>
)

export const FlagGlyph = glyph(
  <path d="M5.8 20.5V4.6c3.6-1.7 6.8 1.7 10.4 0v8.9c-3.6 1.7-6.8-1.7-10.4 0" />
)

export const PlugGlyph = glyph(
  <>
    <path d="M9 3.5v4.2M15 3.5v4.2" />
    <path d="M6.5 7.7h11v3.6a5.5 5.5 0 0 1-11 0Z" />
    <path d="M12 16.8v3.7" />
  </>
)

export const BoxGlyph = glyph(
  <>
    <path d="M12 3.4 20.4 8v8L12 20.6 3.6 16V8Z" />
    <path d="M3.6 8 12 12.6 20.4 8" />
    <path d="M12 12.6v8" />
  </>
)

// The resting frame of the ellipsis ThinkingMark animates, and the ring it grows
// into on the way to the check. One set of numbers, whichever draws them.
export const THINKING_DOTS = [4.9, 12, 19.1]
export const DOT_R = 2.5
export const RING_R = 8.5

export const ThinkingGlyph = glyph(
  <>
    {THINKING_DOTS.map(cx => (
      <circle key={cx} cx={cx} cy={12} r={DOT_R} fill="currentColor" stroke="none" />
    ))}
  </>
)
