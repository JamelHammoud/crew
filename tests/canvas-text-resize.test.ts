import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { Box } from '../src/renderer/src/canvas/math'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, TextShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'
import { Resizing } from '../src/renderer/src/canvas/tools/transforms'
import { fromPlainText } from '../src/renderer/src/canvas/schema'

function board() {
  return new Editor({
    store: createTLStore({ id: 'canvas-text-resize' }),
    shapeUtils: [TextShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
}

function text(editor: Editor, x = 0, y = 0): TLShapeId {
  const id = createShapeId('text-one')
  editor.createShape({
    id,
    type: 'text',
    x,
    y,
    props: { richText: fromPlainText('Hello crew'), autoSize: true, w: 8, scale: 1 }
  })
  editor.select(id)
  return id
}

function drag(editor: Editor, handle: string, from: Vec, to: Vec, modifiers: Record<string, boolean> = {}) {
  const state = new Resizing(editor as never, { transition: () => undefined } as never)
  editor.inputs.pointerDown(from, from, modifiers)
  state.enter({ target: 'selection', handle } as never)
  editor.inputs.pointerMove(to, to, modifiers)
  state.onPointerMove()
  return state
}

describe('resizing a text shape', () => {
  it('takes the width off the right handle and turns auto size off', () => {
    const editor = board()
    const id = text(editor)
    const bounds = editor.getShapePageBounds(id) as Box
    const before = editor.getShape(id)!.props as { w: number; scale: number; autoSize: boolean }

    drag(editor, 'right', new Vec(bounds.maxX, bounds.center.y), new Vec(bounds.maxX + 60, bounds.center.y))

    const after = editor.getShape(id)!.props as { w: number; scale: number; autoSize: boolean }
    expect(after.autoSize).toBe(false)
    expect(after.scale).toBe(before.scale)
    expect(after.w).toBeCloseTo(bounds.width + 60, 4)
    expect(editor.getShape(id)!.x).toBeCloseTo(0, 4)
    expect(editor.getShape(id)!.y).toBeCloseTo(0, 4)
  })

  it('takes the width off the left handle and walks the shape left', () => {
    const editor = board()
    const id = text(editor, 100, 0)
    const bounds = editor.getShapePageBounds(id) as Box

    drag(editor, 'left', new Vec(bounds.minX, bounds.center.y), new Vec(bounds.minX - 40, bounds.center.y))

    const after = editor.getShape(id)!
    expect((after.props as { autoSize: boolean }).autoSize).toBe(false)
    expect((after.props as { w: number }).w).toBeCloseTo(bounds.width + 40, 4)
    expect(after.x).toBeCloseTo(100 - 40, 4)
    expect(after.y).toBeCloseTo(0, 4)
  })

  it('scales the whole shape from a corner rather than changing its width', () => {
    const editor = board()
    const id = text(editor)
    const bounds = editor.getShapePageBounds(id) as Box
    const before = editor.getShape(id)!.props as { w: number; scale: number; autoSize: boolean }

    drag(
      editor,
      'bottom_right',
      new Vec(bounds.maxX, bounds.maxY),
      new Vec(bounds.minX + bounds.width * 2, bounds.minY + bounds.height * 2)
    )

    const after = editor.getShape(id)!.props as { w: number; scale: number; autoSize: boolean }
    expect(after.scale).toBeCloseTo(before.scale * 2, 4)
    expect(after.w).toBe(before.w)
    expect(after.autoSize).toBe(true)
    expect(editor.getShapePageBounds(id)!.width).toBeCloseTo(bounds.width * 2, 4)
    expect(editor.getShapePageBounds(id)!.height).toBeCloseTo(bounds.height * 2, 4)
  })

  it('scales from the top handle without touching the width', () => {
    const editor = board()
    const id = text(editor)
    const bounds = editor.getShapePageBounds(id) as Box
    const before = editor.getShape(id)!.props as { w: number; scale: number }

    drag(
      editor,
      'top',
      new Vec(bounds.center.x, bounds.minY),
      new Vec(bounds.center.x, bounds.maxY - bounds.height * 3)
    )

    const after = editor.getShape(id)!.props as { w: number; scale: number; autoSize: boolean }
    expect(after.scale).toBeCloseTo(before.scale * 3, 4)
    expect(after.w).toBe(before.w)
    expect(after.autoSize).toBe(true)
  })

  it('scales rather than widening when it is one of several shapes being resized', () => {
    const editor = board()
    const id = text(editor)
    const other = createShapeId('geo-one')
    editor.createShape({ id: other, type: 'geo', x: 0, y: 200, props: { w: 100, h: 100 } })
    editor.setSelectedShapes([id, other])
    const bounds = editor.getSelectionRotatedPageBounds() as Box
    const before = editor.getShape(id)!.props as { w: number; scale: number; autoSize: boolean }

    drag(editor, 'right', new Vec(bounds.maxX, bounds.center.y), new Vec(bounds.maxX + bounds.width, bounds.center.y))

    const after = editor.getShape(id)!.props as { w: number; scale: number; autoSize: boolean }
    expect(after.autoSize).toBe(true)
    expect(after.w).toBe(before.w)
    expect(after.scale).toBeCloseTo(before.scale * 2, 4)
  })
})
