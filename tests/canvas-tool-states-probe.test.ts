// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { defaultBindingUtils, defaultShapeUtils } from '../src/renderer/src/canvas/shapes'
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

const TOOLS = [
  SelectTool,
  HandTool,
  DrawShapeTool,
  HighlightShapeTool,
  EraserTool,
  TextShapeTool,
  NoteShapeTool,
  FrameShapeTool,
  LineShapeTool,
  ArrowShapeTool
]

function editor(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'tool-states' }),
    shapeUtils: [...defaultShapeUtils],
    bindingUtils: [...defaultBindingUtils],
    tools: TOOLS,
    getContainer: () =>
      ({ getBoundingClientRect: () => ({ left: 0, top: 0 }), focus: () => undefined }) as unknown as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

function pointerDown(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  subject.dispatch({
    name: 'pointer_down',
    target: 'canvas',
    point: { x, y, z: 0.5 },
    button: 0,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false,
    ...extra
  })
}

function pointerMove(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  subject.dispatch({
    name: 'pointer_move',
    target: 'canvas',
    point: { x, y, z: 0.5 },
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false,
    ...extra
  })
}

function pointerUp(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  subject.dispatch({
    name: 'pointer_up',
    target: 'canvas',
    point: { x, y, z: 0.5 },
    button: 0,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false,
    ...extra
  })
}

function click(subject: Editor, x: number, y: number): void {
  pointerDown(subject, x, y)
  pointerUp(subject, x, y)
}

function drag(subject: Editor, fromX: number, fromY: number, toX: number, toY: number): void {
  pointerDown(subject, fromX, fromY)
  pointerMove(subject, toX, toY)
  pointerUp(subject, toX, toY)
}

function heldDrag(subject: Editor, fromX: number, fromY: number, toX: number, toY: number): void {
  vi.useFakeTimers()
  try {
    pointerDown(subject, fromX, fromY)
    vi.advanceTimersByTime(200)
    pointerMove(subject, toX, toY)
    pointerUp(subject, toX, toY)
  } finally {
    vi.useRealTimers()
  }
}

function shiftClick(subject: Editor, x: number, y: number): void {
  pointerDown(subject, x, y, { shiftKey: true })
  pointerUp(subject, x, y, { shiftKey: true })
}

function geo(subject: Editor, id: string, x: number, y: number, w = 100, h = 100): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'geo', x, y, props: { w, h, fill: 'solid' } })
  return shapeId
}

function segments(subject: Editor): { type: string }[] {
  const shape = subject.getCurrentPageShapes()[0] as { props: { segments: { type: string }[] } }
  return shape.props.segments
}

function points(subject: Editor, id: TLShapeId): { x: number; y: number }[] {
  const shape = subject.getShape(id) as { props: { points: Record<string, { x: number; y: number }> } } | undefined
  return Object.values(shape?.props.points ?? {})
}

describe('every tool reports the state it is standing in', () => {
  it('names the state as well as the tool', () => {
    const subject = editor()
    for (const [tool, path] of [
      ['hand', 'hand.idle'],
      ['draw', 'draw.idle'],
      ['highlight', 'highlight.idle'],
      ['eraser', 'eraser.idle'],
      ['text', 'text.idle'],
      ['note', 'note.idle'],
      ['frame', 'frame.idle'],
      ['line', 'line.idle'],
      ['arrow', 'arrow.idle']
    ] as const) {
      subject.setCurrentTool(tool)
      expect(subject.getCurrentToolPath()).toBe(path)
    }
  })

  it('moves to pointing while a press is held', () => {
    const subject = editor()
    subject.setCurrentTool('frame')
    pointerDown(subject, 50, 50)
    expect(subject.getCurrentToolPath()).toBe('frame.pointing')
  })
})

describe('a tool that creates a shape', () => {
  it('makes a default sized frame on a click and goes back to select', () => {
    const subject = editor()
    subject.setCurrentTool('frame')
    click(subject, 50, 50)
    const shapes = subject.getCurrentPageShapes()
    expect(shapes.length).toBe(1)
    expect(subject.getSelectedShapeIds()).toEqual([shapes[0].id])
    expect(subject.getCurrentToolPath()).toBe('select.idle')
  })

  it('stays armed on the frame tool when tool lock is on', () => {
    const subject = editor()
    subject.updateInstanceState({ isToolLocked: true })
    subject.setCurrentTool('frame')
    click(subject, 50, 50)
    expect(subject.getCurrentPageShapes().length).toBe(1)
    expect(subject.getCurrentToolPath()).toBe('frame.idle')
  })

  it('sizes a frame to the drag and leaves it selected', () => {
    const subject = editor()
    subject.setCurrentTool('frame')
    drag(subject, 50, 50, 250, 150)
    const shape = subject.getCurrentPageShapes()[0]
    expect(shape.props).toMatchObject({ w: 200, h: 100 })
    expect(subject.getSelectedShapeIds()).toEqual([shape.id])
  })

  it('goes back to select after a drag and stays armed under tool lock', () => {
    const loose = editor()
    loose.setCurrentTool('frame')
    drag(loose, 50, 50, 250, 150)
    expect(loose.getCurrentToolPath()).toBe('select.idle')

    const locked = editor()
    locked.updateInstanceState({ isToolLocked: true })
    locked.setCurrentTool('frame')
    drag(locked, 50, 50, 250, 150)
    expect(locked.getCurrentToolPath()).toBe('frame.idle')
  })

  it('leaves nothing behind when the press is cancelled', () => {
    const subject = editor()
    subject.setCurrentTool('frame')
    pointerDown(subject, 50, 50)
    subject.dispatch({ name: 'cancel' })
    expect(subject.getCurrentPageShapes().length).toBe(0)
    expect(subject.getCurrentToolPath()).toBe('frame.idle')
  })

  it('leaves nothing behind when the press is interrupted', () => {
    const subject = editor()
    subject.setCurrentTool('frame')
    pointerDown(subject, 50, 50)
    subject.dispatch({ name: 'interrupt' })
    expect(subject.getCurrentPageShapes().length).toBe(0)
    expect(subject.getCurrentToolPath()).toBe('frame.idle')
  })
})

describe('a frame drawn over other shapes', () => {
  it('takes the shapes it encloses as its children', () => {
    const subject = editor()
    const inside = geo(subject, 'inside', 60, 60, 40, 40)
    const outside = geo(subject, 'outside', 400, 400, 40, 40)
    subject.setCurrentTool('frame')
    drag(subject, 20, 20, 300, 300)
    const frame = subject.getCurrentPageShapes().find(shape => shape.type === 'frame')
    expect(frame).toBeTruthy()
    expect(subject.getShape(inside)?.parentId).toBe(frame?.id)
    expect(subject.getShape(outside)?.parentId).not.toBe(frame?.id)
  })
})

describe('the text tool', () => {
  it('makes an auto width text on a click and puts the caret in it', () => {
    const subject = editor()
    subject.setCurrentTool('text')
    click(subject, 100, 100)
    const shape = subject.getCurrentPageShapes()[0]
    expect(shape.type).toBe('text')
    expect(shape.props).toMatchObject({ autoSize: true })
    expect(subject.getEditingShapeId()).toBe(shape.id)
    expect(subject.getCurrentToolPath()).toBe('select.editing_shape')
  })

  it('makes a fixed width text on a wide drag and puts the caret in it', () => {
    const subject = editor()
    subject.setCurrentTool('text')
    heldDrag(subject, 100, 100, 400, 100)
    const shape = subject.getCurrentPageShapes()[0]
    expect(shape.type).toBe('text')
    expect(shape.props).toMatchObject({ autoSize: false })
    expect(subject.getEditingShapeId()).toBe(shape.id)
  })

  it('reads a short drag as a click rather than a fixed width', () => {
    const subject = editor()
    subject.setCurrentTool('text')
    heldDrag(subject, 100, 100, 105, 100)
    expect(subject.getCurrentPageShapes()[0].props).toMatchObject({ autoSize: true })
  })

  it('comes back to the text tool when the edit ends under tool lock', () => {
    const subject = editor()
    subject.updateInstanceState({ isToolLocked: true })
    subject.setCurrentTool('text')
    click(subject, 100, 100)
    subject.dispatch({ name: 'cancel' })
    expect(subject.getCurrentToolPath()).toBe('text.idle')
  })

  it('lands in select when the edit ends without tool lock', () => {
    const subject = editor()
    subject.setCurrentTool('text')
    click(subject, 100, 100)
    subject.dispatch({ name: 'cancel' })
    expect(subject.getCurrentToolPath()).toBe('select.idle')
  })

  it('comes back to the text tool after a fixed width text under tool lock', () => {
    const subject = editor()
    subject.updateInstanceState({ isToolLocked: true })
    subject.setCurrentTool('text')
    heldDrag(subject, 100, 100, 400, 100)
    subject.dispatch({ name: 'cancel' })
    expect(subject.getCurrentToolPath()).toBe('text.idle')
  })
})

describe('the note tool', () => {
  it('makes a fixed size note on a click and puts the caret in it', () => {
    const subject = editor()
    subject.setCurrentTool('note')
    click(subject, 200, 200)
    const shape = subject.getCurrentPageShapes()[0]
    expect(shape.type).toBe('note')
    expect(subject.getShapePageBounds(shape)).toMatchObject({ w: 200, h: 200 })
    expect(subject.getEditingShapeId()).toBe(shape.id)
  })

  it('centres the note on the point it was pressed', () => {
    const subject = editor()
    subject.setCurrentTool('note')
    click(subject, 200, 200)
    const shape = subject.getCurrentPageShapes()[0]
    expect(shape.x).toBe(100)
    expect(shape.y).toBe(100)
  })

  it('stays armed and skips the caret under tool lock', () => {
    const subject = editor()
    subject.updateInstanceState({ isToolLocked: true })
    subject.setCurrentTool('note')
    click(subject, 200, 200)
    expect(subject.getCurrentPageShapes().length).toBe(1)
    expect(subject.getEditingShapeId()).toBe(null)
    expect(subject.getCurrentToolPath()).toBe('note.idle')
  })
})

describe('the arrow tool', () => {
  it('leaves nothing behind on a click with no drag', () => {
    const subject = editor()
    subject.setCurrentTool('arrow')
    click(subject, 100, 100)
    expect(subject.getCurrentPageShapes().length).toBe(0)
    expect(subject.getCurrentToolPath()).toBe('arrow.idle')
  })

  it('draws an arrow on a drag across empty canvas and binds nothing', () => {
    const subject = editor()
    subject.setCurrentTool('arrow')
    drag(subject, 100, 100, 300, 100)
    const arrow = subject.getCurrentPageShapes().find(shape => shape.type === 'arrow')
    expect(arrow).toBeTruthy()
    expect(subject.getBindingsFromShape(arrow!.id, 'arrow')).toEqual([])
  })

  it('binds the end to a shape the drag lands on', () => {
    const subject = editor()
    geo(subject, 'target', 300, 60, 100, 100)
    subject.setCurrentTool('arrow')
    drag(subject, 100, 100, 350, 110)
    const arrow = subject.getCurrentPageShapes().find(shape => shape.type === 'arrow')
    const bindings = subject.getBindingsFromShape(arrow!.id, 'arrow')
    expect(bindings.map(binding => binding.props.terminal)).toContain('end')
  })
})

describe('the line tool', () => {
  it('places a line on a click and stays on the line tool', () => {
    const subject = editor()
    subject.setCurrentTool('line')
    click(subject, 100, 100)
    expect(subject.getCurrentPageShapes().length).toBe(1)
    expect(subject.getCurrentToolPath()).toBe('line.idle')
  })

  it('moves the end rather than adding a point while the two ends sit together', () => {
    const subject = editor()
    subject.setCurrentTool('line')
    click(subject, 100, 100)
    const id = subject.getCurrentPageShapes()[0].id
    shiftClick(subject, 200, 160)
    expect(subject.getCurrentPageShapes().length).toBe(1)
    expect(points(subject, id).length).toBe(2)
    expect(points(subject, id)[1]).toMatchObject({ x: 100.1, y: 60.1 })
  })

  it('adds a point on every shift click once the line has length', () => {
    const subject = editor()
    subject.setCurrentTool('line')
    click(subject, 100, 100)
    const id = subject.getCurrentPageShapes()[0].id
    shiftClick(subject, 200, 160)
    shiftClick(subject, 300, 100)
    expect(points(subject, id).length).toBe(3)
    shiftClick(subject, 400, 200)
    expect(points(subject, id).length).toBe(4)
  })

  it('takes the line back off on a cancel', () => {
    const subject = editor()
    subject.setCurrentTool('line')
    pointerDown(subject, 100, 100)
    subject.dispatch({ name: 'cancel' })
    expect(subject.getCurrentPageShapes().length).toBe(0)
    expect(subject.getCurrentToolPath()).toBe('line.idle')
  })
})

describe('the eraser', () => {
  it('rubs out a shape it is pressed and released on', () => {
    const subject = editor()
    const id = geo(subject, 'one', 50, 50, 100, 100)
    subject.setCurrentTool('eraser')
    click(subject, 100, 100)
    expect(subject.getShape(id)).toBeUndefined()
    expect(subject.getCurrentToolPath()).toBe('eraser.idle')
  })

  it('rubs out everything the scribble runs through, as one undo', () => {
    const subject = editor()
    const first = geo(subject, 'one', 0, 0, 50, 50)
    const second = geo(subject, 'two', 100, 0, 50, 50)
    subject.setCurrentTool('eraser')
    pointerDown(subject, 25, 25)
    pointerMove(subject, 60, 25)
    pointerMove(subject, 125, 25)
    pointerUp(subject, 125, 25)
    expect(subject.getShape(first)).toBeUndefined()
    expect(subject.getShape(second)).toBeUndefined()
    subject.undo()
    expect(subject.getShape(first)).toBeTruthy()
    expect(subject.getShape(second)).toBeTruthy()
  })

  it('puts back what the scribble had reached when it is cancelled', () => {
    const subject = editor()
    const id = geo(subject, 'one', 0, 0, 50, 50)
    subject.setCurrentTool('eraser')
    pointerDown(subject, 25, 25)
    pointerMove(subject, 60, 25)
    subject.dispatch({ name: 'cancel' })
    expect(subject.getShape(id)).toBeTruthy()
    expect(subject.getCurrentToolPath()).toBe('eraser.idle')
  })
})

describe('the draw tool', () => {
  it('leaves one finished shape behind after a stroke', () => {
    const subject = editor()
    subject.setCurrentTool('draw')
    pointerDown(subject, 100, 100)
    pointerMove(subject, 120, 120)
    pointerMove(subject, 140, 100)
    pointerUp(subject, 140, 100)
    const shape = subject.getCurrentPageShapes()[0]
    expect(shape.type).toBe('draw')
    expect(shape.props).toMatchObject({ isComplete: true })
    expect(subject.getCurrentToolPath()).toBe('draw.idle')
  })

  it('stays armed rather than going back to select', () => {
    const subject = editor()
    subject.setCurrentTool('draw')
    pointerDown(subject, 100, 100)
    pointerMove(subject, 120, 120)
    pointerUp(subject, 120, 120)
    expect(subject.getCurrentToolId()).toBe('draw')
  })

  it('closes a stroke that comes back near where it started', () => {
    const subject = editor()
    subject.setCurrentTool('draw')
    pointerDown(subject, 100, 100)
    for (const [x, y] of [
      [160, 100],
      [160, 160],
      [100, 160],
      [101, 101]
    ]) {
      pointerMove(subject, x, y)
    }
    pointerUp(subject, 101, 101)
    expect(subject.getCurrentPageShapes()[0].props).toMatchObject({ isClosed: true })
  })

  it('never closes a highlight', () => {
    const subject = editor()
    subject.setCurrentTool('highlight')
    pointerDown(subject, 100, 100)
    for (const [x, y] of [
      [160, 100],
      [160, 160],
      [100, 160],
      [101, 101]
    ]) {
      pointerMove(subject, x, y)
    }
    pointerUp(subject, 101, 101)
    const shape = subject.getCurrentPageShapes()[0]
    expect(shape.type).toBe('highlight')
    expect(shape.props).not.toMatchObject({ isClosed: true })
  })

  it('straightens the segment being drawn while shift is held', () => {
    const subject = editor()
    subject.setCurrentTool('draw')
    pointerDown(subject, 100, 100, { shiftKey: true })
    pointerMove(subject, 200, 104, { shiftKey: true })
    pointerUp(subject, 200, 104, { shiftKey: true })
    const shape = subject.getCurrentPageShapes()[0] as { props: { segments: { type: string }[] } }
    expect(shape.props.segments[0].type).toBe('straight')
  })
})

describe('a cancel from an armed tool', () => {
  it('goes back to select', () => {
    const subject = editor()
    for (const tool of ['hand', 'draw', 'highlight', 'eraser', 'text', 'note', 'frame', 'line', 'arrow']) {
      subject.setCurrentTool(tool)
      subject.dispatch({ name: 'cancel' })
      expect(subject.getCurrentToolPath()).toBe('select.idle')
    }
  })
})

describe('the eraser borrowed from another tool', () => {
  it('goes back to the tool that borrowed it once the key is let go', () => {
    const subject = editor()
    subject.setCurrentTool('draw')
    pointerDown(subject, 100, 100, { accelKey: true, ctrlKey: true })
    expect(subject.getCurrentToolPath()).toBe('eraser.pointing')
    pointerUp(subject, 100, 100, { accelKey: true, ctrlKey: true })
    expect(subject.getCurrentToolPath()).toBe('eraser.idle')
    subject.dispatch({ name: 'key_up', key: 'Control', code: 'ControlLeft', ctrlKey: false, metaKey: false })
    expect(subject.getCurrentToolPath()).toBe('draw.idle')
  })

  it('rubs out only the top shape while the key is held', () => {
    const subject = editor()
    const under = geo(subject, 'under', 0, 0, 200, 200)
    const over = geo(subject, 'over', 50, 50, 100, 100)
    subject.setCurrentTool('eraser')
    pointerDown(subject, 100, 100, { accelKey: true })
    pointerUp(subject, 100, 100, { accelKey: true })
    expect(subject.getShape(over)).toBeUndefined()
    expect(subject.getShape(under)).toBeTruthy()
  })
})

describe('a stroke straightened part way through', () => {
  it('opens a straight segment when shift goes down and a free one when it comes up', () => {
    const subject = editor()
    subject.setCurrentTool('draw')
    pointerDown(subject, 100, 100)
    pointerMove(subject, 120, 110)
    subject.dispatch({ name: 'key_down', key: 'Shift', code: 'ShiftLeft', shiftKey: true })
    pointerMove(subject, 220, 110, { shiftKey: true })
    expect(segments(subject).map(segment => segment.type)).toEqual(['free', 'straight'])
    subject.dispatch({ name: 'key_up', key: 'Shift', code: 'ShiftLeft', shiftKey: false })
    pointerMove(subject, 320, 200)
    expect(segments(subject).map(segment => segment.type)).toEqual(['free', 'straight', 'free'])
    pointerUp(subject, 320, 200)
  })
})

describe('a stroke that was never a drag', () => {
  it('is taken back off on an interrupt', () => {
    const subject = editor()
    subject.setCurrentTool('draw')
    pointerDown(subject, 100, 100)
    subject.dispatch({ name: 'interrupt' })
    expect(subject.getCurrentPageShapes().length).toBe(0)
    expect(subject.getCurrentToolPath()).toBe('draw.idle')
  })
})

describe('a note dropped beside another note', () => {
  function firstNote(subject: Editor): void {
    subject.setCurrentTool('note')
    click(subject, 200, 200)
    subject.dispatch({ name: 'cancel' })
    subject.selectNone()
  }

  function nearRightPit(subject: Editor): number {
    return 100 + 300 + (subject.options.adjacentShapeMargin as number) + 4
  }

  it('lands in the pit rather than where the pointer was', () => {
    const subject = editor()
    firstNote(subject)
    const aim = nearRightPit(subject)
    subject.setCurrentTool('note')
    click(subject, aim, 200)
    const notes = subject.getCurrentPageShapes().filter(shape => shape.type === 'note')
    expect(notes.length).toBe(2)
    expect(notes[1].x).toBe(aim - 104)
    expect(notes[1].y).toBe(100)
  })

  it('leaves a note turned even a little out of the pits it offers', () => {
    const subject = editor()
    firstNote(subject)
    const first = subject.getCurrentPageShapes()[0]
    subject.updateShape({ id: first.id, type: 'note', rotation: 0.02 })
    const aim = nearRightPit(subject) - 4
    subject.setCurrentTool('note')
    click(subject, aim, 200)
    const notes = subject.getCurrentPageShapes().filter(shape => shape.type === 'note')
    expect(notes[1].x).toBe(aim - 100)
    expect(notes[1].y).toBe(100)
  })
})

describe('the hand tool', () => {
  it('pans the camera by the drag', () => {
    const subject = editor()
    subject.setCurrentTool('hand')
    pointerDown(subject, 100, 100)
    pointerMove(subject, 160, 140)
    expect(subject.getCurrentToolPath()).toBe('hand.dragging')
    expect(subject.getCamera()).toMatchObject({ x: 60, y: 40 })
  })

  it('comes back to idle when the drag ends', () => {
    const subject = editor()
    subject.setCurrentTool('hand')
    drag(subject, 100, 100, 160, 140)
    expect(subject.getCurrentToolPath()).toBe('hand.idle')
  })
})
