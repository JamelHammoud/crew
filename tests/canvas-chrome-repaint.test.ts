import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, defaultBindingUtils } from '../src/renderer/src/canvas/shapes'
import { react } from '../src/renderer/src/canvas/signals'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'chrome-repaint-test' }),
    shapeUtils: [GeoShapeUtil],
    bindingUtils: defaultBindingUtils,
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return subject
}

function geo(subject: Editor, name: string, x: number, y: number): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'geo', x, y, props: { w: 100, h: 100 } })
  return id
}

function watch(subject: Editor): { runs: () => number; stop: () => void } {
  let count = 0
  const stop = react('chrome repaint', () => {
    const instance = subject.getInstanceState()
    void instance.brush
    void instance.hoveredShapeId
    void instance.hintingShapeIds
    void instance.scribbles
    void instance.isChangingStyle
    void instance.erasingShapeIds
    void instance.cursor
    count += 1
  })
  return { runs: () => count, stop }
}

describe('the selection chrome repaints when what it draws changes', () => {
  it('repaints when the hovered shape changes', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0, 0)
    const two = geo(subject, 'two', 200, 0)
    const painted = watch(subject)
    const before = painted.runs()
    subject.setHoveredShape(one)
    expect(painted.runs()).toBe(before + 1)
    subject.setHoveredShape(two)
    expect(painted.runs()).toBe(before + 2)
    subject.setHoveredShape(null)
    expect(painted.runs()).toBe(before + 3)
    painted.stop()
  })

  it('repaints on every step of a marquee, not only when the selection changes', () => {
    const subject = editor()
    geo(subject, 'one', 0, 0)
    const painted = watch(subject)
    const before = painted.runs()
    for (let step = 1; step <= 10; step++) {
      subject.updateInstanceState({ brush: { x: 0, y: 0, w: step * 4, h: step * 3 } })
    }
    expect(painted.runs()).toBe(before + 10)
    subject.updateInstanceState({ brush: null })
    expect(painted.runs()).toBe(before + 11)
    painted.stop()
  })

  it('repaints when hinting, erasing, scribbles or the cursor change', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0, 0)
    const painted = watch(subject)
    let expected = painted.runs()
    subject.setHintingShapes([one])
    expect(painted.runs()).toBe((expected += 1))
    subject.setErasingShapes([one])
    expect(painted.runs()).toBe((expected += 1))
    subject.updateInstanceState({ scribbles: [{ id: 'a', points: [], size: 1, color: 'black', opacity: 1 } as never] })
    expect(painted.runs()).toBe((expected += 1))
    subject.setCursor({ type: 'grab', rotation: 0 })
    expect(painted.runs()).toBe((expected += 1))
    subject.updateInstanceState({ isChangingStyle: true })
    expect(painted.runs()).toBe((expected += 1))
    painted.stop()
  })

  it('does not repaint when a write changes nothing', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0, 0)
    subject.setHoveredShape(one)
    subject.setCursor({ type: 'grab', rotation: 0 })
    subject.updateInstanceState({ brush: { x: 1, y: 2, w: 3, h: 4 } })
    const painted = watch(subject)
    const before = painted.runs()
    subject.setHoveredShape(one)
    subject.setCursor({ type: 'grab', rotation: 0 })
    subject.updateInstanceState({ brush: { x: 1, y: 2, w: 3, h: 4 } })
    subject.updateInstanceState({ isChangingStyle: false })
    subject.setHintingShapes([])
    expect(painted.runs()).toBe(before)
    painted.stop()
  })

  it('keeps what it was told', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0, 0)
    subject.setHoveredShape(one)
    subject.setHintingShapes([one])
    subject.setCursor({ type: 'grab', rotation: 1 })
    subject.updateInstanceState({ brush: { x: 5, y: 6, w: 7, h: 8 }, isGridMode: true })
    const instance = subject.getInstanceState()
    expect(instance.hoveredShapeId).toBe(one)
    expect(instance.hintingShapeIds).toEqual([one])
    expect(instance.cursor).toEqual({ type: 'grab', rotation: 1 })
    expect(instance.brush).toEqual({ x: 5, y: 6, w: 7, h: 8 })
    expect(instance.isGridMode).toBe(true)
    expect(subject.getHoveredShape()?.id).toBe(one)
    expect(subject.getCurrentPageState().hoveredShapeId).toBe(one)
  })
})
