// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorContext } from '../src/renderer/src/canvas/react'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'
import DesignLeftPanel from '../src/renderer/src/components/DesignLeftPanel'
import { sameLayers } from '../src/renderer/src/design/layerShapes'

const COUNT = 200
const MOVES = 20

const drawn = vi.hoisted(() => ({ layers: 0 }))

vi.mock('../src/renderer/src/design/layerShapes', async () => {
  const actual = await vi.importActual<typeof import('../src/renderer/src/design/layerShapes')>(
    '../src/renderer/src/design/layerShapes'
  )
  return {
    ...actual,
    useLayerShapes: (editor: Parameters<typeof actual.useLayerShapes>[0]) => {
      drawn.layers += 1
      return actual.useLayerShapes(editor)
    }
  }
})

function board(): { editor: Editor; ids: TLShapeId[] } {
  const editor = new Editor({
    store: createTLStore({ id: 'panel-perf' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  editor.setViewportScreenBounds({ x: 0, y: 0, w: 1200, h: 800 })
  const ids: TLShapeId[] = []
  for (let i = 0; i < COUNT; i++) {
    const id = createShapeId(`shape-${i}`)
    editor.createShape({ id, type: 'geo', x: (i % 20) * 60, y: Math.floor(i / 20) * 60, props: { w: 40, h: 40 } })
    ids.push(id)
  }
  return { editor, ids }
}

interface Stand {
  editor: Editor
  ids: TLShapeId[]
  layers(): number
}

function stand(): Stand {
  const { editor, ids } = board()
  editor.setSelectedShapes([ids[0]])
  act(() => {
    render(
      createElement(
        EditorContext.Provider,
        { value: editor },
        createElement(DesignLeftPanel, { onClose: () => undefined })
      )
    )
  })
  drawn.layers = 0
  return { editor, ids, layers: () => drawn.layers }
}

function drag(editor: Editor, id: TLShapeId): void {
  for (let step = 0; step < MOVES; step++) {
    act(() => {
      const shape = editor.getShape(id)!
      editor.updateShape({ id, type: shape.type, x: shape.x + 1, y: shape.y + 1 })
    })
  }
}

afterEach(() => {
  cleanup()
  drawn.layers = 0
})

describe('the layer list while a shape is being dragged', () => {
  it('is handed a new array by the editor for one moved shape', () => {
    const { editor, ids } = board()
    const before = editor.getCurrentPageShapesSorted()
    const shape = editor.getShape(ids[0])!
    editor.updateShape({ id: ids[0], type: shape.type, x: shape.x + 1 })
    expect(editor.getCurrentPageShapesSorted()).not.toBe(before)
  })

  it('reads that array as unchanged when only a position moved', () => {
    const { editor, ids } = board()
    const before = editor.getCurrentPageShapesSorted()
    const shape = editor.getShape(ids[0])!
    editor.updateShape({ id: ids[0], type: shape.type, x: shape.x + 40, y: shape.y + 40, rotation: 0.5 })
    expect(sameLayers(before, editor.getCurrentPageShapesSorted())).toBe(true)
  })

  it('reads it as changed when a name, lock, hide or order really moved', () => {
    const { editor, ids } = board()
    const named = editor.getCurrentPageShapesSorted()
    editor.updateShape({ id: ids[0], type: 'geo', meta: { hidden: true } })
    expect(sameLayers(named, editor.getCurrentPageShapesSorted())).toBe(false)

    const locked = editor.getCurrentPageShapesSorted()
    editor.toggleLock([ids[1]])
    expect(sameLayers(locked, editor.getCurrentPageShapesSorted())).toBe(false)

    const ordered = editor.getCurrentPageShapesSorted()
    editor.bringToFront([ids[2]])
    expect(sameLayers(ordered, editor.getCurrentPageShapesSorted())).toBe(false)
  })

  it('is drawn again for none of the frames of a drag', () => {
    const view = stand()
    drag(view.editor, view.ids[0])
    expect(view.layers()).toBe(0)
  })

  it('is drawn again when a layer really changes', () => {
    const view = stand()
    act(() => {
      view.editor.updateShape({ id: view.ids[0], type: 'geo', meta: { hidden: true } })
    })
    expect(view.layers()).toBe(1)
  })
})
