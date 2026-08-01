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
  it('reorders', () => {
    const subject = editor()
    const a = node(subject, 'a', 0, 0)
    const b = node(subject, 'b', 20, 0)
    const c = node(subject, 'c', 40, 0)
    const order = () => subject.getCurrentPageShapesSorted().map(s => s.id.replace('shape:', ''))
    console.log('start', order())
    subject.setSelectedShapes([a])
    subject.bringToFront([a])
    console.log('a to front', order())
    subject.sendToBack([a])
    console.log('a to back', order())
    subject.bringForward([a])
    console.log('a forward', order())
    subject.sendBackward([a])
    console.log('a backward', order())
    console.log('unused', b, c)
  })

  it('zooms', () => {
    const subject = editor()
    node(subject, 'a', 500, 500)
    console.log('camera at start', subject.getCamera())
    subject.setCamera({ x: 0, y: 0, z: 3 })
    console.log('camera after set', subject.getCamera(), 'zoom', subject.getZoomLevel())
    subject.resetZoom()
    console.log('camera after resetZoom', subject.getCamera(), 'zoom', subject.getZoomLevel())
    subject.zoomToFit()
    console.log('camera after zoomToFit', subject.getCamera(), 'zoom', subject.getZoomLevel())
    subject.setCamera({ x: 0, y: 0, z: 1 })
    subject.zoomToFit({ animation: { duration: 180 } })
    console.log('camera after animated zoomToFit', subject.getCamera(), 'zoom', subject.getZoomLevel())
    subject.setCamera({ x: 0, y: 0, z: 1 })
    subject.selectAll()
    subject.zoomToSelection({ animation: { duration: 180 } })
    console.log('camera after animated zoomToSelection', subject.getCamera())
    subject.setCamera({ x: 0, y: 0, z: 1 })
    subject.zoomIn()
    console.log('camera after zoomIn', subject.getCamera())
    subject.zoomOut()
    console.log('camera after zoomOut', subject.getCamera())
  })

  it('exports', async () => {
    const subject = editor()
    const a = node(subject, 'a', 0, 0)
    const mod = await import('../src/renderer/src/canvas')
    console.log('copyAs type', typeof mod.copyAs)
    try {
      await mod.copyAs(subject, [a], { format: 'svg' })
      console.log('copyAs svg ok')
    } catch (error) {
      console.log('copyAs svg threw', (error as Error).message)
    }
    try {
      await mod.copyAs(subject, [a], { format: 'png' })
      console.log('copyAs png ok')
    } catch (error) {
      console.log('copyAs png threw', (error as Error).message)
    }
  })

  it('checks presence records land', () => {
    const subject = editor()
    console.log('collaborators', typeof (subject as unknown as { getCollaborators?: unknown }).getCollaborators)
    console.log('overlays', subject.overlays.all().map(u => (u.constructor as { type?: string }).type))
  })
})
