// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, it } from 'vitest'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas'
import { Editor } from '../src/renderer/src/canvas/editor'
import { SelectTool } from '../src/renderer/src/canvas/tools'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'scratch-shapes', shapeUtils: designShapeUtils }),
    shapeUtils: designShapeUtils,
    tools: [SelectTool],
    getContainer: () => document.body
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

describe('scratch shapes', () => {
  it('draws a frame with the crew background', () => {
    const subject = editor()
    const id = createShapeId('frame')
    subject.createShape({
      id,
      type: 'frame',
      x: 0,
      y: 0,
      props: { w: 200, h: 120, name: 'Screen' },
      meta: { background: '#123456' }
    })
    const shape = subject.getShape(id)!
    const util = subject.getShapeUtil(shape)
    console.log('frame util options', JSON.stringify(Object.keys((util as unknown as { options: object }).options)))
    const { container } = render(util.component(shape as never) as never)
    console.log('frame html', container.innerHTML.slice(0, 400))
  })

  it('draws text with the crew type', () => {
    const subject = editor()
    const id = createShapeId('text') as TLShapeId
    subject.createShape({ id, type: 'text', x: 0, y: 0, props: {} })
    const shape = subject.getShape(id)!
    subject.updateShape({ id, type: 'text', meta: { family: 'mono', size: 32, weight: 700 } })
    const util = subject.getShapeUtil(subject.getShape(id)!)
    const { container } = render(util.component(subject.getShape(id)! as never) as never)
    console.log('text html', container.innerHTML.slice(0, 500))
  })
})
