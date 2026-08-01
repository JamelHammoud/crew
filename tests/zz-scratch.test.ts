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
import { DESIGN_COMMANDS, type CommandContext } from '../src/renderer/src/design/commands'

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

function snap(subject: Editor): string {
  return JSON.stringify(
    subject
      .getCurrentPageShapesSorted()
      .map(s => [s.type, s.x, s.y, s.parentId, s.isLocked, s.meta.hidden, (s.props as { w?: number }).w])
  )
}

describe('scratch', () => {
  it('reports what each command changed', () => {
    for (const command of DESIGN_COMMANDS) {
      const subject = editor()
      const a = node(subject, 'a', 0, 0)
      const b = node(subject, 'b', 200, 0)
      subject.setSelectedShapes([a, b])
      const ctx: CommandContext = { editor: subject, point: { x: 400, y: 400 }, ask: () => {}, rename: () => {} }
      const before = snap(subject)
      const beforeCamera = JSON.stringify(subject.getCamera())
      const beforeSelection = JSON.stringify(subject.getSelectedShapeIds())
      const enabled = command.when(ctx)
      if (enabled) command.run(ctx)
      const changed =
        before !== snap(subject) ||
        beforeCamera !== JSON.stringify(subject.getCamera()) ||
        beforeSelection !== JSON.stringify(subject.getSelectedShapeIds())
      console.log(`${command.id.padEnd(20)} when=${enabled ? 'yes' : 'NO '} changed=${changed ? 'yes' : 'NO '}`)
    }
  })

  it('reports paste after a copy', () => {
    const subject = editor()
    const a = node(subject, 'a', 0, 0)
    subject.setSelectedShapes([a])
    const ctx: CommandContext = { editor: subject, point: { x: 400, y: 400 }, ask: () => {}, rename: () => {} }
    DESIGN_COMMANDS.find(c => c.id === 'copy')!.run(ctx)
    const paste = DESIGN_COMMANDS.find(c => c.id === 'paste')!
    console.log('paste when', paste.when(ctx))
    paste.run(ctx)
    console.log('shapes after paste', subject.getCurrentPageShapes().length)
    console.log(
      'shapes',
      subject.getCurrentPageShapes().map(s => [s.id, s.x, s.y])
    )
  })

  it('reports copy style then paste style', () => {
    const subject = editor()
    const a = node(subject, 'a', 0, 0)
    const b = node(subject, 'b', 200, 0)
    subject.updateShape({ id: a, type: 'design-node', props: { blend: 'multiply' } })
    subject.setSelectedShapes([a])
    const ctx: CommandContext = { editor: subject, point: null, ask: () => {}, rename: () => {} }
    DESIGN_COMMANDS.find(c => c.id === 'copy-style')!.run(ctx)
    subject.setSelectedShapes([b])
    const pasteStyle = DESIGN_COMMANDS.find(c => c.id === 'paste-style')!
    console.log('paste-style when', pasteStyle.when(ctx))
    pasteStyle.run(ctx)
    console.log('b blend', (subject.getShape(b)!.props as { blend?: string }).blend)
  })
})
