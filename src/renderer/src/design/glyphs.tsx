import {
  CloudIcon,
  FilmIcon,
  HandRaisedIcon,
  LinkIcon,
  PencilIcon,
  PhotoIcon,
  RectangleGroupIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import type { ComponentType, ReactNode } from 'react'
import type { TLShape } from 'tldraw'

export type Glyph = ComponentType<{ className?: string }>

function glyph(art: ReactNode): Glyph {
  return function DesignGlyph({ className = 'w-4 h-4' }: { className?: string }) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {art}
      </svg>
    )
  }
}

export const CursorGlyph = glyph(<path d="M5.5 3 5.5 18.9 9.6 15l2.6 5.6 2.8-1.3-2.6-5.5 5.4-.7Z" />)

export const HandGlyph = HandRaisedIcon

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

export const HexagonGlyph = glyph(<path d="M7.75 4.65h8.5L20.5 12l-4.25 7.35h-8.5L3.5 12Z" />)

export const StarGlyph = StarIcon

export const CloudGlyph = CloudIcon

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

export const PencilGlyph = PencilIcon

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

export const PanelLeftGlyph = glyph(
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="3" />
    <path d="M9.5 5v14" />
  </>
)

export const PanelRightGlyph = glyph(
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="3" />
    <path d="M14.5 5v14" />
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
    <path d="M4 7h16" />
    <path d="M4 12.25h16" strokeWidth={2} />
    <path d="M4 18h16" strokeWidth={3} />
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
  pentagon: HexagonGlyph,
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
  image: PhotoIcon,
  video: FilmIcon,
  group: RectangleGroupIcon,
  embed: LinkIcon,
  bookmark: LinkIcon
}

export function glyphForShape(shape: TLShape): Glyph {
  const geo = (shape.props as { geo?: string }).geo
  if (shape.type === 'geo' && geo) return GEO_GLYPHS[geo] ?? RectangleGlyph
  return TYPE_GLYPHS[shape.type] ?? RectangleGlyph
}
