import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor, type TLTextShape } from '../src/renderer/src/canvas'
import { createShapeId, createTLStore, fromPlainText } from '../src/renderer/src/canvas/schema'
import { TextShapeUtil } from '../src/renderer/src/canvas/shapes'
import {
  measureTextLayout,
  richTextChanged,
  textGrowthMatters,
  type TextGrowthState,
  type TextMeasurer
} from '../src/renderer/src/canvas/text'

const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (html: string) => {
  window: Window & typeof globalThis
}

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement')

function installDom(): void {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: dom.window.HTMLElement })
}

function measureByCharacter(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const characters = this.textContent?.length ?? 0
    const size = Number.parseFloat(this.style.fontSize) || 16
    const width = characters * size * 0.5
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: size, width, height: size, toJSON: () => ({}) }
  })
}

function board(): Editor {
  return new Editor({
    store: createTLStore({ id: 'canvas-text-autosize' }),
    shapeUtils: [TextShapeUtil],
    getContainer: () => document.body
  })
}

const HELLO = fromPlainText('Hello')

function measurer(size: { w: number; h: number }): TextMeasurer {
  return { measureHtml: () => size }
}

function state(patch: Partial<TextGrowthState> = {}): TextGrowthState {
  return {
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    autoSize: true,
    textAlign: 'start',
    width: 40,
    style: 'm|draw|start',
    ...patch
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  if (originalHTMLElement) Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElement)
  else Reflect.deleteProperty(globalThis, 'HTMLElement')
})

describe('the automatic size of a text shape', () => {
  it('gives an automatic shape the measured width and a pixel back', () => {
    const size = measureTextLayout(measurer({ w: 90, h: 30 }), {
      richText: HELLO,
      autoSize: true,
      width: 8,
      fontSize: 24,
      options: { fontFamily: 'sans', fontStyle: 'normal', fontWeight: 'normal', lineHeight: 1.35, padding: '0px' }
    })
    expect(size.width).toBe(91)
    expect(size.height).toBe(30)
  })

  it('never goes narrower than the smallest box a caret can stand in', () => {
    const tiny = measureTextLayout(measurer({ w: 2, h: 4 }), {
      richText: HELLO,
      autoSize: true,
      width: 8,
      fontSize: 24,
      options: { fontFamily: 'sans', fontStyle: 'normal', fontWeight: 'normal', lineHeight: 1.35, padding: '0px' }
    })
    expect(tiny.width).toBe(16)
    expect(tiny.height).toBe(24)
  })

  it('keeps the width it was given once the width is fixed', () => {
    const size = measureTextLayout(measurer({ w: 90, h: 60 }), {
      richText: HELLO,
      autoSize: false,
      width: 120.7,
      fontSize: 24,
      options: { fontFamily: 'sans', fontStyle: 'normal', fontWeight: 'normal', lineHeight: 1.35, padding: '0px' }
    })
    expect(size.width).toBe(120)
    expect(size.height).toBe(60)
  })
})

describe('when a text shape is worth moving', () => {
  it('leaves an update that changed neither the words nor the type alone', () => {
    expect(textGrowthMatters(state(), state(), false)).toBe(false)
  })

  it('moves for a change to the words and for a change to the type', () => {
    expect(textGrowthMatters(state(), state(), true)).toBe(true)
    expect(textGrowthMatters(state(), state({ style: 'l|draw|start' }), false)).toBe(true)
  })

  it('moves when a scaled shape is put back to its own size', () => {
    expect(textGrowthMatters(state({ scale: 2 }), state({ scale: 1 }), false)).toBe(true)
    expect(textGrowthMatters(state({ scale: 2 }), state({ scale: 3 }), false)).toBe(false)
  })

  it('leaves a shape of a fixed width where it stands', () => {
    expect(textGrowthMatters(state({ autoSize: false }), state({ autoSize: false }), true)).toBe(false)
  })

  it('reads two of the same words as the same words', () => {
    expect(richTextChanged(fromPlainText('Crew'), fromPlainText('Crew'))).toBe(false)
    expect(richTextChanged(fromPlainText('Crew'), fromPlainText('Crews'))).toBe(true)
  })
})

describe('a text shape on a board', () => {
  it('measures its own width rather than counting characters', () => {
    installDom()
    measureByCharacter()
    const editor = board()
    const id = createShapeId('measured-text')
    editor.createShape({ id, type: 'text', props: { richText: fromPlainText('Hello'), autoSize: true, w: 8 } })

    const shape = editor.getShape(id) as TLTextShape
    const util = editor.getShapeUtil(shape) as TextShapeUtil
    const spy = vi.spyOn(editor.textMeasure, 'measureHtml')
    const size = util.getMinDimensions(shape)

    expect(spy).toHaveBeenCalled()
    const options = spy.mock.calls[0][1] as Record<string, unknown>
    expect(options.fontSize).toBe(24)
    expect(options.maxWidth).toBeNull()
    expect(size.width).toBe(Math.max(16, 5 * 24 * 0.5 + 1))
  })

  it('grows the box when the words grow and leaves the top edge where it was', () => {
    installDom()
    measureByCharacter()
    const editor = board()
    const id = createShapeId('growing-text')
    editor.createShape({
      id,
      type: 'text',
      x: 50,
      y: 50,
      props: { richText: fromPlainText('Hi'), autoSize: true, w: 8 }
    })
    const narrow = editor.getShapePageBounds(id)!.width

    editor.updateShape<TLTextShape>({ id, type: 'text', props: { richText: fromPlainText('Hello there') } })

    const grown = editor.getShapePageBounds(id)!
    expect(grown.width).toBeGreaterThan(narrow)
    expect(editor.getShape(id)!.y).toBe(50)
    expect(editor.getShape(id)!.x).toBe(50)
  })

  it('leaves the shape where it stands when an update says nothing about the text', () => {
    installDom()
    measureByCharacter()
    const editor = board()
    const id = createShapeId('still-text')
    editor.createShape({
      id,
      type: 'text',
      x: 50,
      y: 50,
      props: { richText: fromPlainText('Hello'), autoSize: true, w: 8 }
    })
    const before = editor.getShape(id) as TLTextShape

    editor.updateShape<TLTextShape>({ id, type: 'text', meta: { note: 'nothing to do with the type' } })

    const after = editor.getShape(id) as TLTextShape
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
    expect(after.props.w).toBe(before.props.w)
  })
})
