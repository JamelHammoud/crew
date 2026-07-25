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
