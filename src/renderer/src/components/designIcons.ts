import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Cloud,
  Copy,
  Diamond,
  Ellipsis,
  EllipsisVertical,
  Eraser,
  Frame,
  Hand,
  Heart,
  Hexagon,
  Highlighter,
  Image,
  Menu,
  Minus,
  MousePointer2,
  MoveUpRight,
  Octagon,
  Pencil,
  Pentagon,
  Plus,
  Redo2,
  Slash,
  Square,
  SquareCheck,
  SquareX,
  Star,
  StickyNote,
  Trash2,
  Triangle,
  Type,
  Undo2,
  X
} from 'lucide-static'

const ICONS: Record<string, string> = {
  'tool-pointer': MousePointer2,
  'tool-hand': Hand,
  'tool-pencil': Pencil,
  'tool-eraser': Eraser,
  'tool-arrow': MoveUpRight,
  'tool-text': Type,
  'tool-note': StickyNote,
  'tool-media': Image,
  'tool-frame': Frame,
  'tool-highlight': Highlighter,
  'tool-line': Slash,
  'geo-rectangle': Square,
  'geo-ellipse': Circle,
  'geo-triangle': Triangle,
  'geo-diamond': Diamond,
  'geo-star': Star,
  'geo-cloud': Cloud,
  'geo-heart': Heart,
  'geo-hexagon': Hexagon,
  'geo-pentagon': Pentagon,
  'geo-octagon': Octagon,
  'geo-x-box': SquareX,
  'geo-check-box': SquareCheck,
  'geo-arrow-up': ArrowUp,
  'geo-arrow-down': ArrowDown,
  'geo-arrow-left': ArrowLeft,
  'geo-arrow-right': ArrowRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'dots-vertical': EllipsisVertical,
  'dots-horizontal': Ellipsis,
  'cross-2': X,
  menu: Menu,
  undo: Undo2,
  redo: Redo2,
  trash: Trash2,
  duplicate: Copy,
  plus: Plus,
  minus: Minus
}

function dataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function designAssetUrls(): ReturnType<typeof getAssetUrlsByImport> | undefined {
  try {
    const base = getAssetUrlsByImport()
    const icons = { ...base.icons }
    for (const [name, svg] of Object.entries(ICONS)) icons[name as keyof typeof icons] = dataUrl(svg)
    return { ...base, icons }
  } catch {
    return undefined
  }
}
