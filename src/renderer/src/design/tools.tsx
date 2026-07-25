import {
  ArrowLongRightIcon,
  CursorArrowRaysIcon,
  HandRaisedIcon,
  PencilIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline'
import type { ComponentType } from 'react'
import { GeoShapeGeoStyle, type Editor } from 'tldraw'
import { designAssetUrls } from '../components/designIcons'

const assets = designAssetUrls()

export function CanvasGlyph({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const url = assets?.icons?.[name as keyof NonNullable<typeof assets>['icons']]
  if (!url) return <span className={className} />
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: 'block',
        background: 'currentColor',
        maskImage: `url("${url}")`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center'
      }}
    />
  )
}

function glyph(name: string): ComponentType<{ className?: string }> {
  return ({ className }) => <CanvasGlyph name={name} className={className} />
}

export interface DesignTool {
  id: string
  label: string
  shortcut: string
  Icon: ComponentType<{ className?: string }>
}

export interface DesignToolGroup {
  id: string
  label: string
  tools: DesignTool[]
}

export const TOOL_GROUPS: DesignToolGroup[] = [
  {
    id: 'pointer',
    label: 'Pointer',
    tools: [
      { id: 'select', label: 'Move', shortcut: 'V', Icon: CursorArrowRaysIcon },
      { id: 'hand', label: 'Hand', shortcut: 'H', Icon: HandRaisedIcon }
    ]
  },
  {
    id: 'frame',
    label: 'Frame',
    tools: [{ id: 'frame', label: 'Frame', shortcut: 'F', Icon: Squares2X2Icon }]
  },
  {
    id: 'shape',
    label: 'Shape',
    tools: [
      { id: 'design-node', label: 'Rectangle', shortcut: 'R', Icon: glyph('geo-rectangle') },
      { id: 'geo:ellipse', label: 'Ellipse', shortcut: 'O', Icon: glyph('geo-ellipse') },
      { id: 'line', label: 'Line', shortcut: 'L', Icon: glyph('tool-line') },
      { id: 'arrow', label: 'Arrow', shortcut: 'Shift L', Icon: ArrowLongRightIcon },
      { id: 'geo:triangle', label: 'Polygon', shortcut: '', Icon: glyph('geo-triangle') },
      { id: 'geo:star', label: 'Star', shortcut: '', Icon: glyph('geo-star') }
    ]
  },
  {
    id: 'pen',
    label: 'Pen',
    tools: [
      { id: 'draw', label: 'Pencil', shortcut: 'Shift P', Icon: PencilIcon },
      { id: 'highlight', label: 'Highlighter', shortcut: 'Shift H', Icon: glyph('tool-highlight') },
      { id: 'eraser', label: 'Eraser', shortcut: 'E', Icon: glyph('tool-eraser') }
    ]
  },
  {
    id: 'text',
    label: 'Text',
    tools: [{ id: 'text', label: 'Text', shortcut: 'T', Icon: glyph('tool-text') }]
  },
  {
    id: 'note',
    label: 'Note',
    tools: [{ id: 'note', label: 'Note', shortcut: 'N', Icon: glyph('tool-note') }]
  }
]

export interface FramePreset {
  label: string
  w: number
  h: number
}

export const FRAME_PRESETS: FramePreset[] = [
  { label: 'Desktop', w: 1440, h: 1024 },
  { label: 'Laptop', w: 1280, h: 800 },
  { label: 'Tablet', w: 834, h: 1194 },
  { label: 'Phone', w: 390, h: 844 }
]

export const ALL_TOOLS: DesignTool[] = TOOL_GROUPS.flatMap(group => group.tools)

export function activateTool(editor: Editor, id: string): void {
  if (id.startsWith('geo:')) {
    editor.run(() => {
      editor.setStyleForNextShapes(GeoShapeGeoStyle, id.slice(4) as never)
      editor.setCurrentTool('geo')
    })
    return
  }
  editor.setCurrentTool(id)
}

export function currentToolId(editor: Editor): string {
  const id = editor.getCurrentToolId()
  if (id !== 'geo') return id
  return `geo:${String(editor.getStyleForNextShape(GeoShapeGeoStyle))}`
}

export function addFrame(editor: Editor, preset: FramePreset): void {
  const center = editor.getViewportPageBounds().center
  editor.run(() => {
    editor.markHistoryStoppingPoint()
    editor.createShape({
      type: 'frame',
      x: Math.round(center.x - preset.w / 2),
      y: Math.round(center.y - preset.h / 2),
      props: { w: preset.w, h: preset.h, name: preset.label }
    })
    editor.setCurrentTool('select')
    editor.zoomToFit({ animation: { duration: 220 } })
  })
}
