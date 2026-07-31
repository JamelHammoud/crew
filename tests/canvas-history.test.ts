import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'

function editor() {
  return new Editor({ store: createTLStore({ id: 'history-test' }), shapeUtils: [FrameShapeUtil, GroupShapeUtil] })
}

function create(subject: Editor, name: string): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'frame', x: 0, y: 0, props: { w: 100, h: 60, name, color: 'black' } })
  return id
}

describe('editor history', () => {
  it('undoes and redoes a stopped document change', () => {
    const subject = editor()
    const id = create(subject, 'one')
    subject.markHistoryStoppingPoint('created')
    expect(subject.getShape(id)).toBeDefined()
    subject.undo()
    expect(subject.getShape(id)).toBeUndefined()
    subject.redo()
    expect(subject.getShape(id)).toBeDefined()
  })

  it('squashes repeated changes back to one mark', () => {
    const subject = editor()
    const id = create(subject, 'one')
    subject.markHistoryStoppingPoint('baseline')
    const mark = subject.markHistoryStoppingPoint('drag')
    subject.updateShape({ id, type: 'frame', x: 10 })
    subject.markHistoryStoppingPoint('step')
    subject.updateShape({ id, type: 'frame', x: 20 })
    subject.markHistoryStoppingPoint('step')
    subject.updateShape({ id, type: 'frame', x: 30 })
    subject.markHistoryStoppingPoint('done')
    subject.squashToMark(mark)
    expect(subject.getShape(id)?.x).toBe(30)
    subject.undo()
    expect(subject.getShape(id)?.x).toBe(0)
    subject.redo()
    expect(subject.getShape(id)?.x).toBe(30)
  })

  it('does not record remote store changes', () => {
    const subject = editor()
    const id = create(subject, 'one')
    subject.markHistoryStoppingPoint('created')
    subject.store.mergeRemoteChanges(() => {
      const shape = subject.getShape(id)!
      subject.store.put([{ ...shape, x: 75 }])
    })
    expect(subject.getShape(id)?.x).toBe(75)
    expect(subject.history.getNumUndos()).toBe(2)
    expect(subject.history.getNumRedos()).toBe(0)
  })

  it('keeps camera and selection out of document history', () => {
    const subject = editor()
    const id = create(subject, 'one')
    subject.markHistoryStoppingPoint('created')
    const count = subject.history.getNumUndos()
    subject.select(id)
    subject.setCamera({ x: 10, y: 20, z: 2 })
    expect(subject.history.getNumUndos()).toBe(count)
  })
})
