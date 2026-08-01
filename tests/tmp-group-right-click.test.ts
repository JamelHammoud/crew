// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { defaultBindingUtils, defaultShapeUtils } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools'
import { availableCommands, shapesUnder } from '../src/renderer/src/design/commands'

function editor(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'group-right-click' }),
    shapeUtils: [...defaultShapeUtils],
    bindingUtils: [...defaultBindingUtils],
    tools: [SelectTool],
    getContainer: () =>
      ({ getBoundingClientRect: () => ({ left: 0, top: 0 }), focus: () => undefined }) as unknown as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1200, h: 900 })
  return subject
}

function rightClick(subject: Editor, x: number, y: number): void {
  subject.dispatch({
    name: 'right_click',
    target: 'canvas',
    point: { x, y, z: 0.5 },
    button: 2,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false
  } as never)
}

function grouped(subject: Editor, gap: number): string {
  const one = createShapeId()
  const other = createShapeId()
  subject.createShapes([
    { id: one, type: 'geo', x: 0, y: 0, props: { w: 100, h: 100, fill: 'solid' } },
    { id: other, type: 'geo', x: 100 + gap, y: 0, props: { w: 100, h: 100, fill: 'solid' } }
  ])
  subject.selectNone()
  subject.setSelectedShapes([one, other])
  subject.groupShapes([one, other])
  const group = subject.getCurrentPageShapes().find(shape => shape.type === 'group')
  subject.selectNone()
  return group!.id
}

function ctxFor(subject: Editor, point: { x: number; y: number }) {
  return { editor: subject, point, ask: () => undefined, rename: () => undefined }
}

describe('right clicking a group', () => {
  it('two shapes side by side leave no gap, so every point hits a child', () => {
    const subject = editor()
    const group = grouped(subject, 0)
    rightClick(subject, 100, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
    expect(availableCommands(ctxFor(subject, { x: 100, y: 50 })).map(one => one.id)).toContain('ungroup')
  })

  it('a gap between the two shapes is a hole the right click falls through', () => {
    const subject = editor()
    const group = grouped(subject, 200)
    const hole = { x: 200, y: 50 }
    expect(subject.getShapeAtPoint(hole, { hitInside: false, margin: 0, renderingOnly: true })).toBeUndefined()
    expect(shapesUnder(subject, hole).map(one => one.type)).toEqual(['group'])
    rightClick(subject, hole.x, hole.y)
    console.log('selection after right click:', JSON.stringify(subject.getSelectedShapeIds()))
    console.log('menu at the hole:', JSON.stringify(availableCommands(ctxFor(subject, hole)).map(one => one.id)))
    expect(group).toBeTruthy()
  })
})
