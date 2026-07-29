import type { TLShape } from 'tldraw'
import { nodeShapeOf, type NodeShape } from '../../../shared/designNode'
import { glyph, type Glyph } from '../components/glyph'
import {
  ClipboardGlyph,
  CloudGlyph,
  DuplicateGlyph,
  EyeGlyph,
  EyeOffGlyph,
  FilmGlyph,
  GroupGlyph,
  HandGlyph,
  LinkGlyph,
  LockGlyph,
  PencilGlyph,
  PhotoGlyph,
  SearchGlyph,
  SparkGlyph,
  StarGlyph,
  TrashGlyph,
  UnlockGlyph
} from '../icons'
import { ARROW_BODY, ARROW_ON_GRID } from './cursors'

export type { Glyph }

// The canvas draws its own vocabulary, and takes the rest from the icon set. A
// shape, a lock, an eye and a bin are not canvas ideas, and a second drawing of
// one is how two sets that nearly agree start. The open hand needs no turning
// over here: it is drawn with its thumb on the left already, like the cursor.
export {
  CloudGlyph,
  DuplicateGlyph,
  EyeGlyph,
  EyeOffGlyph,
  GroupGlyph,
  HandGlyph,
  LockGlyph,
  PencilGlyph,
  SearchGlyph,
  SparkGlyph,
  StarGlyph,
  TrashGlyph,
  UnlockGlyph
}

export { ClipboardGlyph as PasteGlyph, PhotoGlyph as ImageGlyph }

export const CursorGlyph = glyph(<path d={ARROW_BODY} transform={ARROW_ON_GRID} />)

export const FrameGlyph = glyph(
  <>
    <path d="M8.25 3v18M15.75 3v18" />
    <path d="M3 8.25h18M3 15.75h18" />
  </>
)

export const RectangleGlyph = glyph(<rect x="4" y="4" width="16" height="16" rx="2.5" />)

export const EllipseGlyph = glyph(<circle cx="12" cy="12" r="8" />)

export const OvalGlyph = glyph(<rect x="3" y="6" width="18" height="12" rx="6" />)

export const TriangleGlyph = glyph(<path d="M12 4.25 20.5 19.25H3.5Z" />)

export const DiamondGlyph = glyph(<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" />)

export const PentagonGlyph = glyph(<path d="M12 3.5 20.1 9.4 17 18.9H7L3.9 9.4Z" />)

export const HexagonGlyph = glyph(<path d="M7.75 4.65h8.5L20.5 12l-4.25 7.35h-8.5L3.5 12Z" />)

export const XBoxGlyph = glyph(
  <>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </>
)

export const CheckBoxGlyph = glyph(
  <>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="m8.5 12.25 2.5 2.5 4.5-5.5" />
  </>
)

export const LineGlyph = glyph(<path d="M5 19 19 5" />)

export const ArrowGlyph = glyph(
  <>
    <path d="M5 19 19 5" />
    <path d="M12.25 5H19v6.75" />
  </>
)

export const HighlighterGlyph = glyph(
  <>
    <path d="m14.75 4.5 4.75 4.75-8.5 8.5L6.25 13Z" />
    <path d="M6.25 13 4 20l7-2.25" />
    <path d="M13 20.5h7.5" />
  </>
)

export const EraserGlyph = glyph(
  <>
    <g transform="rotate(-45 12 12)">
      <rect x="3.5" y="8.5" width="17" height="7" rx="2" />
      <path d="M8.5 8.5v7" />
    </g>
    <path d="M8.75 20.5h11.75" />
  </>
)

export const TextGlyph = glyph(
  <>
    <path d="M5.5 7.25V5.5h13v1.75" />
    <path d="M12 5.5v13" />
    <path d="M9 18.5h6" />
  </>
)

export const NoteGlyph = glyph(
  <>
    <path d="M20 12.5v-6A2.5 2.5 0 0 0 17.5 4h-11A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h6Z" />
    <path d="M12.5 20v-5a2.5 2.5 0 0 1 2.5-2.5h5" />
  </>
)

export const CornerGlyph = glyph(<path d="M5 19V9.5A4.5 4.5 0 0 1 9.5 5H19" />)

export const CornersGlyph = glyph(
  <>
    <path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9" />
    <path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9" />
    <path d="M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15" />
    <path d="M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" />
  </>
)

export const OpacityGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
  </>
)

export const AngleGlyph = glyph(
  <>
    <path d="M5 4.5v15h15" />
    <path d="M13 19.5A8.5 8.5 0 0 0 5 11" />
  </>
)

export const ShadowGlyph = glyph(
  <>
    <rect x="3.5" y="3.5" width="12" height="12" rx="2.5" />
    <path d="M8 20h9.5a2.5 2.5 0 0 0 2.5-2.5V8" />
  </>
)

export const BlurGlyph = glyph(<rect x="4" y="4" width="16" height="16" rx="2.5" strokeDasharray="2 2.5" />)

export const WeightGlyph = glyph(
  <>
    <path d="M4 7h16" strokeWidth={1.25} />
    <path d="M4 12.25h16" strokeWidth={2.25} />
    <path d="M4 18h16" strokeWidth={3.5} />
  </>
)

export const ClipGlyph = glyph(
  <>
    <path d="M7 2.5v12.9A1.6 1.6 0 0 0 8.6 17h12.9" />
    <path d="M2.5 7h12.9A1.6 1.6 0 0 1 17 8.6v12.9" />
  </>
)

export const ConstrainGlyph = glyph(
  <>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M9 15h6v-6" />
  </>
)

export const AlignLeftGlyph = glyph(
  <>
    <path d="M4 3.5v17" />
    <rect x="7.5" y="6" width="12.5" height="4.5" rx="1.5" />
    <rect x="7.5" y="13.5" width="8" height="4.5" rx="1.5" />
  </>
)

export const AlignCenterGlyph = glyph(
  <>
    <path d="M12 3.5v17" />
    <rect x="4.5" y="6" width="15" height="4.5" rx="1.5" />
    <rect x="7.5" y="13.5" width="9" height="4.5" rx="1.5" />
  </>
)

export const AlignRightGlyph = glyph(
  <>
    <path d="M20 3.5v17" />
    <rect x="4" y="6" width="12.5" height="4.5" rx="1.5" />
    <rect x="8.5" y="13.5" width="8" height="4.5" rx="1.5" />
  </>
)

export const AlignTopGlyph = glyph(
  <>
    <path d="M3.5 4h17" />
    <rect x="6" y="7.5" width="4.5" height="12.5" rx="1.5" />
    <rect x="13.5" y="7.5" width="4.5" height="8" rx="1.5" />
  </>
)

export const AlignMiddleGlyph = glyph(
  <>
    <path d="M3.5 12h17" />
    <rect x="6" y="4.5" width="4.5" height="15" rx="1.5" />
    <rect x="13.5" y="7.5" width="4.5" height="9" rx="1.5" />
  </>
)

export const AlignBottomGlyph = glyph(
  <>
    <path d="M3.5 20h17" />
    <rect x="6" y="4" width="4.5" height="12.5" rx="1.5" />
    <rect x="13.5" y="8.5" width="4.5" height="8" rx="1.5" />
  </>
)

export const FlipHorizontalGlyph = glyph(
  <>
    <path d="M12 3.5v17" strokeDasharray="2 3" />
    <path d="M9.25 7.25 4 12l5.25 4.75Z" />
    <path d="M14.75 7.25 20 12l-5.25 4.75Z" />
  </>
)

export const FlipVerticalGlyph = glyph(
  <>
    <path d="M3.5 12h17" strokeDasharray="2 3" />
    <path d="M7.25 9.25 12 4l4.75 5.25Z" />
    <path d="M7.25 14.75 12 20l4.75-5.25Z" />
  </>
)

const LETTER_A = (
  <>
    <path d="M9.1 16.75 12 7.75l2.9 9" />
    <path d="M10.1 14h3.8" />
  </>
)

export const LineHeightGlyph = glyph(
  <>
    <path d="M4 4h16M4 20h16" />
    {LETTER_A}
  </>
)

export const LetterSpacingGlyph = glyph(
  <>
    <path d="M4 4v16M20 4v16" />
    {LETTER_A}
  </>
)

export const TextTopGlyph = glyph(
  <>
    <path d="M4 4h16" />
    <path d="M12 20V8.5" />
    <path d="m8.5 12 3.5-3.5 3.5 3.5" />
  </>
)

export const TextMiddleGlyph = glyph(
  <>
    <path d="M4 12h16" />
    <path d="M12 3.5V8m0 8v4.5" />
    <path d="m9.5 5.5 2.5 2.5 2.5-2.5M9.5 18.5l2.5-2.5 2.5 2.5" />
  </>
)

export const TextBottomGlyph = glyph(
  <>
    <path d="M4 20h16" />
    <path d="M12 4v11.5" />
    <path d="m8.5 12 3.5 3.5 3.5-3.5" />
  </>
)

export const TypeSettingsGlyph = glyph(
  <>
    <path d="M9 4v4.5M9 13.5V20" />
    <circle cx="9" cy="11" r="2.5" />
    <path d="M15 4v8.5M15 17.5V20" />
    <circle cx="15" cy="15" r="2.5" />
  </>
)

export const UnderlineGlyph = glyph(
  <>
    <path d="M7 4.5v6.25a5 5 0 0 0 10 0V4.5" />
    <path d="M6 20h12" />
  </>
)

export const StrikeGlyph = glyph(
  <>
    <path d="M16 7.4c-.85-1.2-2.2-1.9-3.9-1.9-2.2 0-3.85 1.1-3.85 2.85 0 1.2.7 2 2.1 2.55" />
    <path d="M8.1 16.4c.85 1.3 2.3 2.1 4.1 2.1 2.3 0 4-1.15 4-3 0-1.3-.8-2.15-2.35-2.7" />
    <path d="M4.5 12h15" />
  </>
)

const STACK_BACK = <rect x="4" y="4" width="11" height="11" rx="2" />
const STACK_FRONT = <rect x="9" y="9" width="11" height="11" rx="2" />

export const ToFrontGlyph = glyph(
  <>
    <path d="M4 15V6a2 2 0 0 1 2-2h9" strokeDasharray="2 2.5" />
    {STACK_FRONT}
  </>
)

export const ToBackGlyph = glyph(
  <>
    {STACK_BACK}
    <path d="M20 9v9a2 2 0 0 1-2 2H9" strokeDasharray="2 2.5" />
  </>
)

export const ForwardGlyph = glyph(
  <>
    <path d="M12 20V8" />
    <path d="M7 13l5-5 5 5" />
    <path d="M4 4h16" strokeDasharray="2 2.5" />
  </>
)

export const BackwardGlyph = glyph(
  <>
    <path d="M12 4v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 20h16" strokeDasharray="2 2.5" />
  </>
)

export const UngroupGlyph = glyph(
  <>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 20h2.5a1.5 1.5 0 0 0 1.5-1.5V16" />
    <rect x="4" y="12" width="8" height="8" rx="1.5" />
    <rect x="12" y="4" width="8" height="8" rx="1.5" />
  </>
)

export const MaskGlyph = glyph(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" stroke="none" />
    <path d="M4 12h16" strokeDasharray="2 2.5" />
  </>
)

export const AutoLayoutGlyph = glyph(
  <>
    <rect x="4" y="4" width="16" height="16" rx="2.5" strokeDasharray="2 2.5" />
    <rect x="7" y="7" width="4" height="10" rx="1" />
    <rect x="13" y="7" width="4" height="10" rx="1" />
  </>
)

export const RotateGlyph = glyph(
  <>
    <path d="M20 12a8 8 0 1 1-2.35-5.65" />
    <path d="M20 4v4h-4" />
  </>
)

export const RenameGlyph = glyph(
  <>
    <path d="M4 8V6h16v2" />
    <path d="M12 6v12" />
    <path d="M9 18h6" />
  </>
)

export const SelectAllGlyph = glyph(
  <>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
  </>
)

export const DeselectGlyph = glyph(
  <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
)

export const ZoomFitGlyph = glyph(
  <>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M8 10V9h2M16 14v1h-2" />
  </>
)

export const ZoomSelectionGlyph = glyph(
  <>
    <path d="M4 8V6h2M18 6h2v2M20 16v2h-2M6 18H4v-2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </>
)

export const ZoomOneGlyph = glyph(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
    <path d="M10 9.5 11.5 8.5v5" />
  </>
)

export const StyleGlyph = glyph(
  <>
    <path d="M12 4 6 20h12L12 4Z" />
    <path d="M8.5 14h7" />
  </>
)

export const LayersGlyph = glyph(
  <>
    <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8Z" />
    <path d="m4.5 12 7.5 4 7.5-4" />
    <path d="m4.5 16 7.5 4 7.5-4" />
  </>
)

const GEO_GLYPHS: Record<string, Glyph> = {
  rectangle: RectangleGlyph,
  ellipse: EllipseGlyph,
  oval: OvalGlyph,
  triangle: TriangleGlyph,
  diamond: DiamondGlyph,
  hexagon: HexagonGlyph,
  star: StarGlyph,
  cloud: CloudGlyph,
  'x-box': XBoxGlyph,
  'check-box': CheckBoxGlyph,
  rhombus: DiamondGlyph,
  'rhombus-2': DiamondGlyph,
  pentagon: PentagonGlyph,
  octagon: HexagonGlyph,
  trapezoid: HexagonGlyph,
  'arrow-right': ArrowGlyph,
  'arrow-left': ArrowGlyph,
  'arrow-up': ArrowGlyph,
  'arrow-down': ArrowGlyph,
  heart: StarGlyph
}

const TYPE_GLYPHS: Record<string, Glyph> = {
  frame: FrameGlyph,
  'design-node': RectangleGlyph,
  draw: PencilGlyph,
  highlight: HighlighterGlyph,
  text: TextGlyph,
  note: NoteGlyph,
  line: LineGlyph,
  arrow: ArrowGlyph,
  image: PhotoGlyph,
  video: FilmGlyph,
  group: GroupGlyph,
  embed: LinkGlyph,
  bookmark: LinkGlyph
}

const NODE_GLYPHS: Record<NodeShape, Glyph> = {
  rect: RectangleGlyph,
  ellipse: EllipseGlyph,
  triangle: TriangleGlyph,
  diamond: DiamondGlyph,
  pentagon: PentagonGlyph,
  hexagon: HexagonGlyph,
  star: StarGlyph
}

export function glyphForShape(shape: TLShape): Glyph {
  const props = shape.props as { geo?: string; shape?: unknown }
  if (shape.type === 'geo' && props.geo) return GEO_GLYPHS[props.geo] ?? RectangleGlyph
  if (shape.type === 'design-node') return NODE_GLYPHS[nodeShapeOf(props.shape)]
  return TYPE_GLYPHS[shape.type] ?? RectangleGlyph
}
