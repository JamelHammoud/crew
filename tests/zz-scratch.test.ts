import { describe, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'
import { DesignNodeTool } from '../src/renderer/src/design/DesignNodeTool'
import {
  ArrowShapeTool,
  DrawShapeTool,
  EraserTool,
  FrameShapeTool,
  HandTool,
  HighlightShapeTool,
  LineShapeTool,
  NoteShapeTool,
  SelectTool,
  TextShapeTool
} from '../src/renderer/src/canvas/tools'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'scratch', shapeUtils: designShapeUtils }),
    shapeUtils: designShapeUtils,
    tools: [
      SelectTool,
      HandTool,
      DrawShapeTool,
      HighlightShapeTool,
      EraserTool,
      TextShapeTool,
      NoteShapeTool,
      FrameShapeTool,
      LineShapeTool,
      ArrowShapeTool,
      DesignNodeTool
    ],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

function node(subject: Editor, name: string, x: number, y: number): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'design-node', x, y, props: { w: 100, h: 60, name } })
  return id
}

describe('scratch', () => {
  it('animates the camera when given time', async () => {
    const subject = editor()
    node(subject, 'a', 500, 500)
    subject.setCamera({ x: 0, y: 0, z: 1 })
    subject.zoomToFit({ animation: { duration: 120 } })
    console.log('immediately after', subject.getCamera())
    await new Promise(resolve => setTimeout(resolve, 400))
    console.log('after 400ms', subject.getCamera())
  })

  it('has the export surface', () => {
    const subject = editor() as unknown as Record<string, unknown>
    for (const name of ['getSvgString', 'toImage', 'getSvgElement', 'getCurrentPageShapeIds']) {
      console.log(name, typeof subject[name])
    }
  })
})
