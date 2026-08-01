import { describe, expect, it } from 'vitest'
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
import { ALL_TOOLS, activateTool, currentToolId } from '../src/renderer/src/design/tools'
import { applyDesignDefaults } from '../src/renderer/src/design/defaults'
import { keepWholePixels } from '../src/renderer/src/design/wholePixels'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'design-live', shapeUtils: designShapeUtils }),
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

function context(subject: Editor): CommandContext {
  return { editor: subject, point: { x: 0, y: 0 }, ask: () => {}, rename: () => {} }
}

describe('the design tab against the real engine', () => {
  it('runs every command it offers without throwing', () => {
    const broken: string[] = []
    for (const command of DESIGN_COMMANDS) {
      const subject = editor()
      const a = node(subject, 'a', 0, 0)
      const b = node(subject, 'b', 200, 0)
      subject.setSelectedShapes([a, b])
      const ctx = context(subject)
      try {
        if (command.when(ctx)) command.run(ctx)
      } catch (error) {
        broken.push(`${command.id}: ${(error as Error).message}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('offers every command that should be available on a selection', () => {
    const subject = editor()
    const a = node(subject, 'a', 0, 0)
    const b = node(subject, 'b', 200, 0)
    subject.setSelectedShapes([a, b])
    const ctx = context(subject)
    const available = DESIGN_COMMANDS.filter(command => command.when(ctx)).map(command => command.id)
    expect(available).toContain('group')
    expect(available).toContain('mask')
    expect(available).toContain('frame')
    expect(available).toContain('hide')
    expect(available).toContain('lock')
    expect(available).toContain('flip-h')
  })

  it('activates every tool in the toolbar', () => {
    const subject = editor()
    const broken: string[] = []
    for (const tool of ALL_TOOLS) {
      try {
        activateTool(subject, tool.id)
        if (currentToolId(subject) !== tool.id) broken.push(`${tool.id} became ${currentToolId(subject)}`)
      } catch (error) {
        broken.push(`${tool.id}: ${(error as Error).message}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('applies the design style defaults', () => {
    const subject = editor()
    expect(() => applyDesignDefaults(subject)).not.toThrow()
  })

  it('keeps whole pixels through the side effects', () => {
    const subject = editor()
    const stop = keepWholePixels(subject)
    const id = createShapeId('rounded')
    subject.createShape({ id, type: 'design-node', x: 10.4, y: 20.6, props: { w: 100.3, h: 60.2 } })
    const shape = subject.getShape(id)!
    expect(shape.x).toBe(10)
    expect(shape.y).toBe(21)
    stop()
  })
})
