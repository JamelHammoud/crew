import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars3Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  EllipsisVerticalIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type IconComponent = ComponentType<{ className?: string }>

// tldraw still draws its own context menus and dialogs, so the glyphs it reaches for are
// swapped out for the Heroicons the rest of crew uses. Everything crew draws itself comes
// from src/renderer/src/design/glyphs.tsx.
const ICONS: Record<string, IconComponent> = {
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

function build(): ReturnType<typeof getAssetUrlsByImport> | undefined {
  try {
    const base = getAssetUrlsByImport()
    const icons = { ...base.icons }
    for (const [name, icon] of Object.entries(ICONS)) icons[name as keyof typeof icons] = dataUrl(icon)
    return { ...base, icons }
  } catch {
    return undefined
  }
}

let cached: ReturnType<typeof build> | undefined
let built = false

export function designAssetUrls(): ReturnType<typeof getAssetUrlsByImport> | undefined {
  if (!built) {
    cached = build()
    built = true
  }
  return cached
}
