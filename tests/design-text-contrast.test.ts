// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShape, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { defaultBindingUtils, defaultShapeUtils } from '../src/renderer/src/canvas/shapes'
import { SelectTool, TextShapeTool } from '../src/renderer/src/canvas/tools'
import { DesignNodeUtil } from '../src/renderer/src/design/DesignNodeUtil'
import { nodeDefaults, solid, type Paint } from '../src/shared/designNode'
import {
  BOARD_SURFACE,
  backgroundBehind,
  hexOf,
  inkFor,
  isDarkColor,
  luminanceOf,
  over,
  readColor,
  textInkAt
} from '../src/renderer/src/design/textContrast'
import { DARK_INK, WHITE_INK, contrastRatio, fillsInk, inkOn, readInk } from '../src/shared/textContrast'

function editor(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'text-contrast' }),
    shapeUtils: [...defaultShapeUtils, DesignNodeUtil],
    bindingUtils: [...defaultBindingUtils],
    tools: [SelectTool, TextShapeTool],
    getContainer: () =>
      ({ getBoundingClientRect: () => ({ left: 0, top: 0 }), focus: () => undefined }) as unknown as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

function palette(subject: Editor): Record<string, unknown> {
  return subject.getCurrentTheme().colors[subject.getColorMode()] as unknown as Record<string, unknown>
}

function node(subject: Editor, fill: string, opacity = 1): TLShapeId {
  const id = createShapeId()
  subject.createShape({
    id,
    type: 'design-node',
    x: 0,
    y: 0,
    props: { ...nodeDefaults(), w: 200, h: 200, fills: [{ ...solid(fill), opacity }] }
  })
  return id
}

function frame(subject: Editor, background: string): TLShapeId {
  const id = createShapeId()
  subject.createShape({ id, type: 'frame', x: 0, y: 0, props: { w: 200, h: 200 }, meta: { background } })
  return id
}

function writeText(subject: Editor, x: number, y: number): TLShape {
  const before = new Set(subject.getCurrentPageShapes().map(shape => shape.id))
  subject.setCurrentTool('text')
  subject.dispatch({
    name: 'pointer_down',
    target: 'canvas',
    point: { x, y, z: 0.5 },
    button: 0,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false
  })
  subject.dispatch({
    name: 'pointer_up',
    target: 'canvas',
    point: { x, y, z: 0.5 },
    button: 0,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false
  })
  const shape = subject
    .getCurrentPageShapes()
    .find(candidate => candidate.type === 'text' && !before.has(candidate.id))
  if (!shape) throw new Error('no text shape was made')
  return shape
}

function inkOf(shape: TLShape): unknown {
  return (shape.props as { color?: unknown }).color
}

describe('reading a colour', () => {
  it('takes hex in three, six and eight digits', () => {
    expect(readColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(readColor('#0d0d0d')).toEqual({ r: 13, g: 13, b: 13, a: 1 })
    expect(readColor('#00000080')?.a).toBeCloseTo(0.502, 3)
  })

  it('takes rgb and rgba', () => {
    expect(readColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 })
    expect(readColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
    expect(readColor('rgb(0 128 255 / 50%)')).toEqual({ r: 0, g: 128, b: 255, a: 0.5 })
  })

  it('takes a palette name against the palette it belongs to', () => {
    const subject = editor()
    expect(readColor('yellow', palette(subject))).toEqual(readColor('#f1ac4b'))
    expect(readColor('black', palette(subject))).toEqual(readColor('#1d1d1d'))
  })

  it('says nothing for what it cannot read', () => {
    expect(readColor('mauve')).toBeNull()
    expect(readColor('')).toBeNull()
    expect(readColor('linear-gradient(red, blue)')).toBeNull()
  })
})

describe('the light or dark rule', () => {
  it('weights the channels the way the eye does', () => {
    expect(luminanceOf({ r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(1, 6)
    expect(luminanceOf({ r: 0, g: 0, b: 0, a: 1 })).toBeCloseTo(0, 6)
    expect(luminanceOf({ r: 0, g: 255, b: 0, a: 1 })).toBeGreaterThan(luminanceOf({ r: 0, g: 0, b: 255, a: 1 }))
  })

  it('lands white on a dark background and near black on a light one', () => {
    expect(inkFor('#ffffff')).toBe('black')
    expect(inkFor('#f2f2f2')).toBe('black')
    expect(inkFor('#0d0d0d')).toBe('white')
    expect(inkFor('#1d1d1d')).toBe('white')
  })

  it('reads mid grey as light, since black on it is the stronger contrast', () => {
    expect(isDarkColor('#808080')).toBe(false)
    expect(inkFor('#808080')).toBe('black')
  })

  it('reads mid green as light, where an average of the channels would not', () => {
    const green = readColor('#00a000')
    if (!green) throw new Error('mid green would not read')
    expect((green.r + green.g + green.b) / 3 / 255).toBeLessThan(0.5)
    expect(inkFor('#00a000')).toBe('black')
  })

  it('reads a saturated blue as dark', () => {
    expect(inkFor('#4465e9')).toBe('white')
  })

  it('takes a palette name as well as a hex', () => {
    const subject = editor()
    expect(inkFor('white', palette(subject))).toBe('black')
    expect(inkFor('black', palette(subject))).toBe('white')
    expect(inkFor('yellow', palette(subject))).toBe('black')
  })
})

describe('a colour you can see through', () => {
  it('blends it over what is behind before deciding', () => {
    const white = readColor('#ffffff')
    const black = readColor('#000000')
    const half = readColor('#ffffff80')
    if (!white || !black || !half) throw new Error('a colour would not read')
    expect(hexOf(over(half, black))).toBe('#808080')
    expect(inkFor(hexOf(over(half, black)))).toBe('black')
    expect(inkFor(hexOf(over({ ...black, a: 0.5 }, white)))).toBe('black')
    expect(inkFor(hexOf(over({ ...white, a: 0.15 }, black)))).toBe('white')
  })

  it('leaves what is behind alone when there is nothing on top', () => {
    const black = readColor('#000000')
    const white = readColor('#ffffff')
    if (!black || !white) throw new Error('a colour would not read')
    expect(hexOf(over({ ...white, a: 0 }, black))).toBe('#000000')
    expect(hexOf(over({ ...black, a: 0 }, white))).toBe('#ffffff')
  })
})

describe('what is behind a point on a board', () => {
  it('is the board itself where nothing has been drawn', () => {
    const subject = editor()
    expect(BOARD_SURFACE).toBe('#0d0d0d')
    expect(backgroundBehind(subject, { x: 400, y: 300 })).toBe(BOARD_SURFACE)
    expect(textInkAt(subject, { x: 400, y: 300 })).toBe('white')
  })

  it('is the fill of the shape under the point', () => {
    const subject = editor()
    node(subject, '#222222')
    expect(backgroundBehind(subject, { x: 100, y: 100 })).toBe('#222222')
    expect(textInkAt(subject, { x: 100, y: 100 })).toBe('white')
  })

  it('is the frame background where the point is in a frame', () => {
    const subject = editor()
    frame(subject, '#ffffff')
    expect(textInkAt(subject, { x: 100, y: 100 })).toBe('black')
  })

  it('is the topmost shape where they overlap', () => {
    const subject = editor()
    frame(subject, '#111111')
    node(subject, '#ffffff')
    expect(textInkAt(subject, { x: 100, y: 100 })).toBe('black')
  })

  it('falls back through a fill you can see through', () => {
    const subject = editor()
    node(subject, '#ffffff', 0.15)
    expect(textInkAt(subject, { x: 100, y: 100 })).toBe('white')
  })

  it('takes an opaque fill on its own terms', () => {
    const subject = editor()
    node(subject, '#ffffff', 1)
    expect(textInkAt(subject, { x: 100, y: 100 })).toBe('black')
  })
})

describe('text made on a board', () => {
  it('lands white over a dark shape', () => {
    const subject = editor()
    node(subject, '#222222')
    expect(inkOf(writeText(subject, 100, 100))).toBe('white')
  })

  it('lands black over a light shape', () => {
    const subject = editor()
    node(subject, '#f2f2f2')
    expect(inkOf(writeText(subject, 100, 100))).toBe('black')
  })

  it('lands black inside a white frame and white outside it', () => {
    const subject = editor()
    frame(subject, '#ffffff')
    expect(inkOf(writeText(subject, 100, 100))).toBe('black')
    expect(inkOf(writeText(subject, 500, 400))).toBe('white')
  })

  it('lands white on the board itself', () => {
    const subject = editor()
    expect(inkOf(writeText(subject, 400, 300))).toBe('white')
  })

  it('is never recoloured once it has been made', () => {
    const subject = editor()
    const under = node(subject, '#222222')
    const text = writeText(subject, 100, 100)
    expect(inkOf(text)).toBe('white')
    subject.updateShape({ id: under, type: 'design-node', props: { fills: [solid('#ffffff')] } })
    expect(inkOf(subject.getShape(text.id) as TLShape)).toBe('white')
  })

  it('keeps a colour somebody chose for themselves', () => {
    const subject = editor()
    node(subject, '#222222')
    const text = writeText(subject, 100, 100)
    subject.updateShape({ id: text.id, type: 'text', props: { color: 'blue' } })
    expect(inkOf(subject.getShape(text.id) as TLShape)).toBe('blue')
  })
})

function filled(subject: Editor, fills: Paint[]): TLShapeId {
  const id = createShapeId()
  subject.createShape({ id, type: 'design-node', x: 0, y: 0, props: { ...nodeDefaults(), w: 200, h: 200, fills } })
  return id
}

function gradient(stops: string[], opacity = 1, visible = true): Paint {
  return { type: 'linear', angle: 180, stops: stops.map((color, at) => ({ color, at })), opacity, visible }
}

describe('the maths on its own', () => {
  it('reads a colour and weighs the channels without a board anywhere near it', () => {
    expect(readInk('#0d0d0d')).toEqual({ r: 13, g: 13, b: 13, a: 1 })
    expect(inkOn({ r: 13, g: 13, b: 13, a: 1 })).toBe('white')
    expect(inkOn({ r: 242, g: 242, b: 242, a: 1 })).toBe('black')
  })

  it('picks the ink with the better ratio rather than a luminance threshold', () => {
    const grey = readInk('#808080')
    if (!grey) throw new Error('mid grey would not read')
    expect(contrastRatio(grey, WHITE_INK)).toBeCloseTo(3.95, 2)
    expect(contrastRatio(grey, DARK_INK)).toBeCloseTo(4.27, 2)
    expect(inkOn(grey)).toBe('black')
  })

  it('takes a gradient on the average of its stops', () => {
    const ink = fillsInk([gradient(['#000000', '#ffffff'])], readInk)
    if (!ink) throw new Error('the gradient would not read')
    expect(hexOf(ink)).toBe('#808080')
  })

  it('leaves an invisible fill out and a fill too faint to matter with it', () => {
    expect(fillsInk([gradient(['#ffffff', '#ffffff'], 1, false)], readInk)).toBeNull()
    expect(fillsInk([{ ...solid('#ffffff'), opacity: 0.01 }], readInk)).toBeNull()
    expect(fillsInk([], readInk)).toBeNull()
  })

  it('reads down to the first fill that really covers what is under it', () => {
    const ink = fillsInk([{ ...solid('#ffffff'), visible: false }, solid('#222222'), solid('#ffffff')], readInk)
    if (!ink) throw new Error('the fills would not read')
    expect(hexOf(ink)).toBe('#222222')
  })
})

describe('fills that are not a background', () => {
  it('leaves out an invisible fill and lands on what is really painted', () => {
    const subject = editor()
    filled(subject, [{ ...solid('#ffffff'), visible: false }, solid('#222222')])
    expect(backgroundBehind(subject, { x: 100, y: 100 })).toBe('#222222')
    expect(inkOf(writeText(subject, 100, 100))).toBe('white')
  })

  it('falls through an invisible fill to the board', () => {
    const subject = editor()
    filled(subject, [{ ...solid('#ffffff'), visible: false }])
    expect(backgroundBehind(subject, { x: 100, y: 100 })).toBe(BOARD_SURFACE)
    expect(inkOf(writeText(subject, 100, 100))).toBe('white')
  })

  it('falls through a fill too faint to matter', () => {
    const subject = editor()
    filled(subject, [{ ...solid('#ffffff'), opacity: 0.01 }])
    expect(backgroundBehind(subject, { x: 100, y: 100 })).toBe(BOARD_SURFACE)
    expect(inkOf(writeText(subject, 100, 100))).toBe('white')
  })

  it('never takes a line as a background', () => {
    const subject = editor()
    const id = createShapeId()
    subject.createShape({ id, type: 'line', x: 0, y: 0 })
    expect(backgroundBehind(subject, { x: 0, y: 0 })).toBe(BOARD_SURFACE)
  })
})

describe('text over a gradient', () => {
  it('lands white where the stops average dark', () => {
    const subject = editor()
    filled(subject, [gradient(['#000000', '#222222'])])
    expect(inkOf(writeText(subject, 100, 100))).toBe('white')
  })

  it('lands black where the stops average light', () => {
    const subject = editor()
    filled(subject, [gradient(['#ffffff', '#dddddd'])])
    expect(inkOf(writeText(subject, 100, 100))).toBe('black')
  })

  it('reads the average rather than the stop it happens to sit on', () => {
    const subject = editor()
    filled(subject, [gradient(['#000000', '#ffffff'])])
    expect(backgroundBehind(subject, { x: 10, y: 10 })).toBe('#808080')
    expect(inkOf(writeText(subject, 10, 10))).toBe('black')
  })
})
