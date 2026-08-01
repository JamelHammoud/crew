// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement, Profiler, type ReactNode } from 'react'
import { afterEach, describe, it } from 'vitest'
import { EditorContext } from '../src/renderer/src/canvas/react'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'
import DesignLeftPanel from '../src/renderer/src/components/DesignLeftPanel'
import DesignPanel from '../src/renderer/src/design/DesignPanel'

const COUNT = 200
const MOVES = 20
function board() {
  const editor = new Editor({
    store: createTLStore({ id: 'p' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  editor.setViewportScreenBounds({ x: 0, y: 0, w: 1200, h: 800 })
  const ids: TLShapeId[] = []
  for (let i = 0; i < COUNT; i++) {
    const id = createShapeId(`s-${i}`)
    editor.createShape({ id, type: 'geo', x: (i % 20) * 60, y: Math.floor(i / 20) * 60, props: { w: 40, h: 40 } })
    ids.push(id)
  }
  return { editor, ids }
}
function measure(label: string, node: (e: Editor, r: (n: number) => void) => ReactNode) {
  const { editor, ids } = board()
  editor.setSelectedShapes([ids[0]])
  let c = 0, ms = 0
  const rec = (spent: number) => { c += 1; ms += spent }
  act(() => { render(node(editor, rec)) })
  c = 0; ms = 0
  for (let i = 0; i < MOVES; i++) act(() => {
    const s = editor.getShape(ids[0])!
    editor.updateShape({ id: ids[0], type: s.type, x: s.x + 1, y: s.y + 1 })
  })
  console.log(`${label}: ${c} commits, ${ms.toFixed(1)}ms over ${MOVES} moves -> ${(ms/MOVES).toFixed(2)}ms/move`)
}
const wrap = (Comp: any) => (e: Editor, r: (n: number) => void) =>
  createElement(EditorContext.Provider, { value: e },
    createElement(Profiler, { id: 'x', onRender: (_a: string, _b: string, actual: number) => r(actual) }, createElement(Comp)))
afterEach(cleanup)
describe('numbers', () => {
  it('left panel', () => measure('DesignLeftPanel', wrap(DesignLeftPanel)))
  it('inspector', () => measure('DesignPanel (inspector)', wrap(DesignPanel)))
})
