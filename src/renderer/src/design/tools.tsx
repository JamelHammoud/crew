import { type Editor, type TLShape } from 'tldraw'
import { nodeShapeOf } from '../../../shared/designNode'
import { nextNodeShape, setNextNodeShape } from './nextShape'
import {
  ArrowGlyph,
  CursorGlyph,
  DiamondGlyph,
  EllipseGlyph,
  EraserGlyph,
  FrameGlyph,
  HandGlyph,
  HexagonGlyph,
  HighlighterGlyph,
  LineGlyph,
  NoteGlyph,
  PencilGlyph,
  PentagonGlyph,
  RectangleGlyph,
  StarGlyph,
  TextGlyph,
  TriangleGlyph,
  type Glyph
} from './glyphs'

export interface DesignTool {
  id: string
  label: string
  shortcut: string
  Icon: Glyph
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
      { id: 'select', label: 'Move', shortcut: 'V', Icon: CursorGlyph },
      { id: 'hand', label: 'Hand', shortcut: 'H', Icon: HandGlyph }
    ]
  },
  {
    id: 'frame',
    label: 'Frame',
    tools: [{ id: 'frame', label: 'Frame', shortcut: 'F', Icon: FrameGlyph }]
  },
  {
    id: 'shape',
    label: 'Shape',
    tools: [
      { id: 'node:rect', label: 'Rectangle', shortcut: 'R', Icon: RectangleGlyph },
      { id: 'node:ellipse', label: 'Ellipse', shortcut: 'O', Icon: EllipseGlyph },
      { id: 'line', label: 'Line', shortcut: 'L', Icon: LineGlyph },
      { id: 'arrow', label: 'Arrow', shortcut: 'Shift L', Icon: ArrowGlyph },
      { id: 'node:triangle', label: 'Triangle', shortcut: '', Icon: TriangleGlyph },
      { id: 'node:diamond', label: 'Diamond', shortcut: '', Icon: DiamondGlyph },
      { id: 'node:pentagon', label: 'Pentagon', shortcut: '', Icon: PentagonGlyph },
      { id: 'node:hexagon', label: 'Hexagon', shortcut: '', Icon: HexagonGlyph },
      { id: 'node:star', label: 'Star', shortcut: '', Icon: StarGlyph }
    ]
  },
  {
    id: 'pen',
    label: 'Pen',
    tools: [
      { id: 'draw', label: 'Pencil', shortcut: 'Shift P', Icon: PencilGlyph },
      { id: 'highlight', label: 'Highlighter', shortcut: 'Shift H', Icon: HighlighterGlyph },
      { id: 'eraser', label: 'Eraser', shortcut: 'E', Icon: EraserGlyph }
    ]
  },
  {
    id: 'text',
    label: 'Text',
    tools: [{ id: 'text', label: 'Text', shortcut: 'T', Icon: TextGlyph }]
  },
  {
    id: 'note',
    label: 'Note',
    tools: [{ id: 'note', label: 'Note', shortcut: 'N', Icon: NoteGlyph }]
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
  if (id.startsWith('node:')) {
    setNextNodeShape(nodeShapeOf(id.slice(5)))
    editor.setCurrentTool('design-node')
    return
  }
  editor.setCurrentTool(id)
}

export function currentToolId(editor: Editor): string {
  const id = editor.getCurrentToolId()
  return id === 'design-node' ? `node:${nextNodeShape()}` : id
}

export function layerName(shape: TLShape): string {
  const props = shape.props as Record<string, unknown>
  const name = typeof props.name === 'string' ? props.name.trim() : ''
  if (name) return name
  if (typeof props.text === 'string' && props.text.trim()) return props.text.trim().slice(0, 40)
  if (shape.type === 'geo' && typeof props.geo === 'string') return props.geo
  return shape.type
}

export function canRename(shape: TLShape): boolean {
  return shape.type === 'frame' || shape.type === 'design-node'
}

export function renameShape(editor: Editor, shape: TLShape, name: string): void {
  if (shape.type === 'frame') editor.updateShape({ id: shape.id, type: 'frame', props: { name } })
  if (shape.type === 'design-node') editor.updateShape({ id: shape.id, type: 'design-node', props: { name } })
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
