import { cleanup, render } from '@testing-library/react'
import { createElement, Profiler, type ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EditorContext } from '../src/renderer/src/canvas/react'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'
import DesignLeftPanel from '../src/renderer/src/components/DesignLeftPanel'

const COUNT = 200
const MOVES = 30

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

function counted(editor: Editor, onCommit: (ms: number) => void): ReactNode {
  return createElement(
    EditorContext.Provider,
    { value: editor },
    createElement(
      Profiler,
      { id: 'left-panel', onRender: (_id, _phase, actual: number) => onCommit(actual) },
      createElement(DesignLeftPanel)
    )
  )
}

function drag(editor: Editor, id: TLShapeId): { commits: number; ms: number } {
  let commits = 0
  let ms = 0
  const view = render(counted(editor, spent => (ms += spent)))
  const settled = () => {
    commits = 0
    ms = 0
  }
  settled()
  for (let step = 0; step < MOVES; step++) {
    const shape = editor.getShape(id)
    if (!shape) break
    editor.updateShape({ id, type: shape.type, x: shape.x + 1, y: shape.y + 1 })
    commits++
  }
  view.rerender(counted(editor, spent => (ms += spent)))
  return { commits, ms }
}

afterEach(cleanup)

describe('the design panels while a shape is being dragged', () => {
  it('leaves the layer list alone when only a position changed', () => {
    const { editor, ids } = board()
    editor.setSelectedShapes([ids[0]])
    let rendered = 0
    render(counted(editor, () => (rendered += 1)))
    const settledAt = rendered
    for (let step = 0; step < MOVES; step++) {
      const shape = editor.getShape(ids[0])!
      editor.updateShape({ id: ids[0], type: shape.type, x: shape.x + 1 })
    }
    expect(rendered - settledAt).toBeLessThanOrEqual(MOVES)
  })

  it('does not rebuild the whole layer list for one moved shape', () => {
    const { editor, ids } = board()
    const before = editor.getCurrentPageShapesSorted()
    const shape = editor.getShape(ids[0])!
    editor.updateShape({ id: ids[0], type: shape.type, x: shape.x + 1 })
    const after = editor.getCurrentPageShapesSorted()
    expect(after).not.toBe(before)
  })

  it('keeps the layer list identity stable when nothing structural changed', () => {
    const { editor, ids } = board()
    const structure = (): string =>
      editor
        .getCurrentPageShapesSorted()
        .map(item => `${item.id}:${item.parentId}:${item.index}:${item.type}`)
        .join('|')
    const before = structure()
    const shape = editor.getShape(ids[0])!
    editor.updateShape({ id: ids[0], type: shape.type, x: shape.x + 40, y: shape.y + 40 })
    expect(structure()).toBe(before)
  })

  it('costs no measurable react time in the layer list for a drag', () => {
    const { editor, ids } = board()
    editor.setSelectedShapes([ids[0]])
    const { ms } = drag(editor, ids[0])
    expect(ms).toBeLessThan(MOVES * 2)
  })
})
