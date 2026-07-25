import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowLongRightIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars3Icon,
  ChatBubbleOvalLeftIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CursorArrowRaysIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  EllipsisVerticalIcon,
  HandRaisedIcon,
  MinusIcon,
  PencilIcon,
  PhotoIcon,
  PlusIcon,
  Squares2X2Icon,
  StarIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type IconComponent = ComponentType<{ className?: string }>

// tldraw draws these as CSS masks, so each Heroicon is flattened to an SVG string once.
// Anything without a real Heroicon equivalent keeps tldraw's own glyph.
const ICONS: Record<string, IconComponent> = {
  'tool-pointer': CursorArrowRaysIcon,
  'tool-hand': HandRaisedIcon,
  'tool-pencil': PencilIcon,
  'tool-eraser': XMarkIcon,
  'tool-arrow': ArrowLongRightIcon,
  'tool-text': Bars3Icon,
  'tool-note': ChatBubbleOvalLeftIcon,
  'tool-media': PhotoIcon,
  'tool-frame': Squares2X2Icon,
  'geo-star': StarIcon,
  'geo-arrow-up': ArrowUpIcon,
  'geo-arrow-down': ArrowDownIcon,
  'geo-arrow-left': ArrowLeftIcon,
  'geo-arrow-right': ArrowRightIcon,
  'chevron-up': ChevronUpIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  'dots-vertical': EllipsisVerticalIcon,
  'dots-horizontal': EllipsisHorizontalIcon,
  'cross-2': XMarkIcon,
  menu: Bars3Icon,
  undo: ArrowUturnLeftIcon,
  redo: ArrowUturnRightIcon,
  trash: TrashIcon,
  duplicate: DocumentDuplicateIcon,
  plus: PlusIcon,
  minus: MinusIcon
}

function dataUrl(icon: IconComponent): string {
  const svg = renderToStaticMarkup(createElement(icon))
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function designAssetUrls(): ReturnType<typeof getAssetUrlsByImport> | undefined {
  try {
    const base = getAssetUrlsByImport()
    const icons = { ...base.icons }
    for (const [name, icon] of Object.entries(ICONS)) icons[name as keyof typeof icons] = dataUrl(icon)
    return { ...base, icons }
  } catch {
    return undefined
  }
}
