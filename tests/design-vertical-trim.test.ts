import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CSSProperties, ReactElement } from 'react'
import { Editor, type TLTextShape } from '../src/renderer/src/canvas'
import { createShapeId, createTLStore, fromPlainText, getSnapshot, loadSnapshot } from '../src/renderer/src/canvas/schema'
import { clearFaceMetrics, resolveLineHeight } from '../src/renderer/src/canvas/text'
import { DesignTextUtil, textTrim } from '../src/renderer/src/design/TextUtil'
import { setTextShapeType, textShapeType } from '../src/renderer/src/design/textType'
import { BASE_TYPE, type TypeStyle } from '../src/shared/designNode'

const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (
  html: string,
  options: { pretendToBeVisual: boolean }
) => { window: Window & typeof globalThis }

const globalKeys = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node'] as const

const originalGlobals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const))

let dom: { window: Window & typeof globalThis }

function setGlobal(key: (typeof globalKeys)[number], value: unknown): void {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}

const ASCENT = 90
const DESCENT = 25
const CAP = 70
const PROBE = 100

let face = { ascent: ASCENT, descent: DESCENT, cap: CAP }
let asked: string[] = []

function fakeFace(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    const context = {
      font: '',
      measureText: (text: string) => {
        asked.push(`${context.font} ${text}`)
        return {
          fontBoundingBoxAscent: face.ascent,
          fontBoundingBoxDescent: face.descent,
          actualBoundingBoxAscent: face.cap
        } as TextMetrics
      }
    }
    return context as unknown as CanvasRenderingContext2D
  })
}

function measuredByLines(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const line = Number.parseFloat(this.style.lineHeight) || 24
    const markup = this.innerHTML
    const rows = Math.max(1, (markup.match(/<p[\s>]/g) ?? []).length) + (markup.match(/<br/g) ?? []).length
    const width = (this.textContent ?? '').length * 10
    const height = rows * line
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}) } as DOMRect
  })
}

beforeAll(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
  const view = dom.window
  setGlobal('window', view)
  setGlobal('document', view.document)
  setGlobal('navigator', view.navigator)
  setGlobal('HTMLElement', view.HTMLElement)
  setGlobal('HTMLCanvasElement', view.HTMLCanvasElement)
  setGlobal('Element', view.Element)
  setGlobal('Node', view.Node)
})

afterAll(() => {
  dom.window.close()
  for (const key of globalKeys) {
    const descriptor = originalGlobals.get(key)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

beforeEach(() => {
  face = { ascent: ASCENT, descent: DESCENT, cap: CAP }
  asked = []
  clearFaceMetrics()
  fakeFace()
  measuredByLines()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function typeOf(patch: Partial<TypeStyle>): TypeStyle {
  return { ...BASE_TYPE, ...patch }
}

function board(id: string): Editor {
  return new Editor({
    store: createTLStore({ id }),
    shapeUtils: [DesignTextUtil],
    getContainer: () => dom.window.document.body
  })
}

function textShape(editor: Editor, id: string, props: Record<string, unknown> = {}): TLTextShape {
  const shapeId = createShapeId(id)
  editor.createShape({
    id: shapeId,
    type: 'text',
    x: 0,
    y: 0,
    props: { autoSize: true, scale: 1, richText: fromPlainText('Hello'), ...props }
  })
  return editor.getShape(shapeId) as TLTextShape
}

function paintedStyle(editor: Editor, shape: TLTextShape): CSSProperties {
  const drawn = editor.getShapeUtil(shape).component?.(shape) as ReactElement<{ style?: CSSProperties }>
  return drawn.props.style ?? {}
}

describe('what a cap height trim measures', () => {
  it('takes the cap height off the ink of a capital and the line box off the face', () => {
    const trim = textTrim(typeOf({ family: 'Probe One', size: PROBE, lineHeight: 1.5, trim: 'cap' }))

    expect(asked.some(call => call.endsWith(' H'))).toBe(true)
    expect(trim).toEqual({ top: 37.5, bottom: 42.5, total: 80, cap: 70 })
  })

  it('scales every part of it with the font size', () => {
    const trim = textTrim(typeOf({ family: 'Probe Two', size: 16, lineHeight: 1.5, trim: 'cap' }))

    expect(trim).toEqual({ top: 6, bottom: 6.8, total: 12.8, cap: 11.2 })
  })

  it('leaves the top of the box on the cap and the bottom on the baseline', () => {
    const size = 16
    const trim = textTrim(typeOf({ family: 'Probe Three', size, lineHeight: 1.5, trim: 'cap' }))!
    const line = resolveLineHeight(size, 1.5)
    const leading = (line - (ASCENT + DESCENT) * (size / PROBE)) / 2

    expect(trim.top).toBeCloseTo(leading + (ASCENT - CAP) * (size / PROBE), 10)
    expect(trim.bottom).toBeCloseTo(leading + DESCENT * (size / PROBE), 10)
    expect(trim.top + trim.bottom).toBeCloseTo(trim.total, 10)
    expect(line - trim.total).toBeCloseTo(trim.cap, 10)
  })

  it('measures a face once however many sizes it is asked about', () => {
    textTrim(typeOf({ family: 'Probe Four', size: 12, lineHeight: 1.5, trim: 'cap' }))
    textTrim(typeOf({ family: 'Probe Four', size: 96, lineHeight: 2, trim: 'cap' }))
    const once = asked.length

    textTrim(typeOf({ family: 'Probe Five', size: 12, lineHeight: 1.5, trim: 'cap' }))

    expect(once).toBeGreaterThan(0)
    expect(asked.length).toBeGreaterThan(once)
  })

  it('reads the face again once the real one has landed', () => {
    const fallback = textTrim(typeOf({ family: 'Probe Six', size: 100, lineHeight: 1.5, trim: 'cap' }))!

    face = { ascent: 100, descent: 30, cap: 60 }
    const stale = textTrim(typeOf({ family: 'Probe Six', size: 100, lineHeight: 1.5, trim: 'cap' }))!
    clearFaceMetrics()
    const landed = textTrim(typeOf({ family: 'Probe Six', size: 100, lineHeight: 1.5, trim: 'cap' }))!

    expect(stale).toEqual(fallback)
    expect(landed.cap).toBe(60)
    expect(landed).not.toEqual(fallback)
  })

  it('trims nothing at all when it is standard', () => {
    expect(textTrim(typeOf({ family: 'Probe Seven', size: 100, trim: 'none' }))).toBeNull()
    expect(asked).toEqual([])
  })
})

describe('a board saved before there was a vertical trim', () => {
  it('reads as standard with nothing written down for it', () => {
    const editor = board('vertical-trim-old-board')
    const shape = textShape(editor, 'old-text')

    expect(textShapeType(editor, shape).trim).toBe('none')
    expect(textTrim(textShapeType(editor, shape))).toBeNull()
  })

  it('reads as standard from a stored type that never held one', () => {
    const editor = board('vertical-trim-old-meta')
    const shape = textShape(editor, 'old-meta')
    editor.updateShape({
      id: shape.id,
      type: 'text',
      meta: { type: { family: 'sans', size: 21, weight: 600, lineHeight: 1.4 } }
    })

    const type = textShapeType(editor, editor.getShape(shape.id) as TLTextShape)
    expect(type).toMatchObject({ size: 21, weight: 600, trim: 'none' })
  })

  it('keeps a board nobody has touched byte for byte', () => {
    const editor = board('vertical-trim-untouched')
    const shape = textShape(editor, 'untouched')
    editor.updateShape({
      id: shape.id,
      type: 'text',
      meta: { type: { family: 'sans', size: 21, weight: 600, lineHeight: 1.4 } }
    })
    const written = JSON.stringify(getSnapshot(editor.store))

    expect(written).not.toContain('"trim"')
  })

  it('carries the trim through a snapshot and back once it is asked for', () => {
    const editor = board('vertical-trim-round-trip')
    const shape = textShape(editor, 'round-trip')
    setTextShapeType(editor, shape, { trim: 'cap', size: 16, lineHeight: 1.5 })
    const snapshot = JSON.parse(JSON.stringify(getSnapshot(editor.store)))

    const store = createTLStore({ id: 'vertical-trim-round-trip-again' })
    loadSnapshot(store, snapshot)
    const reloaded = new Editor({ store, shapeUtils: [DesignTextUtil], getContainer: () => dom.window.document.body })

    const type = textShapeType(reloaded, reloaded.getShape(shape.id) as TLTextShape)
    expect(type).toMatchObject({ trim: 'cap', size: 16, lineHeight: 1.5 })
  })
})

describe('an automatic text box wearing the trim', () => {
  it('ends up shorter by the room above the cap and under the baseline', () => {
    const editor = board('vertical-trim-shorter')
    const shape = textShape(editor, 'shorter')
    setTextShapeType(editor, shape, { family: 'Probe Box', size: 16, lineHeight: 1.5 })
    const standard = editor.getShapeGeometry(editor.getShape(shape.id)!).bounds.h

    setTextShapeType(editor, editor.getShape(shape.id) as TLTextShape, { trim: 'cap' })
    const trimmed = editor.getShapeGeometry(editor.getShape(shape.id)!).bounds.h

    const trim = textTrim(textShapeType(editor, editor.getShape(shape.id) as TLTextShape))!
    expect(standard).toBe(resolveLineHeight(16, 1.5))
    expect(trimmed).toBeCloseTo(standard - trim.total, 10)
    expect(trimmed).toBeCloseTo(trim.cap, 10)
  })

  it('hugs the letters of every line rather than only the first', () => {
    const editor = board('vertical-trim-lines')
    const one = textShape(editor, 'one-line')
    const two = textShape(editor, 'two-lines', { richText: fromPlainText('Hello\nthere') })
    for (const shape of [one, two]) {
      setTextShapeType(editor, editor.getShape(shape.id) as TLTextShape, {
        family: 'Probe Lines',
        size: 16,
        lineHeight: 1.5,
        trim: 'cap'
      })
    }

    const line = resolveLineHeight(16, 1.5)
    const trim = textTrim(textShapeType(editor, editor.getShape(one.id) as TLTextShape))!
    const short = editor.getShapeGeometry(editor.getShape(one.id)!).bounds.h
    const tall = editor.getShapeGeometry(editor.getShape(two.id)!).bounds.h

    expect(short).toBeCloseTo(trim.cap, 10)
    expect(tall).toBeCloseTo(line + trim.cap, 10)
  })
})

describe('the box the trim measures and the box it paints', () => {
  it('paints the text at the height it was measured at', () => {
    const editor = board('vertical-trim-paint')
    const shape = textShape(editor, 'painted')
    setTextShapeType(editor, shape, { family: 'Probe Paint', size: 16, lineHeight: 1.5, trim: 'cap' })

    const live = editor.getShape(shape.id) as TLTextShape
    const style = paintedStyle(editor, live)
    const trim = textTrim(textShapeType(editor, live))!

    expect(style.minHeight).toBeCloseTo(editor.getShapeGeometry(live).bounds.h, 10)
    expect(style.marginTop).toBeCloseTo(-trim.top, 10)
    expect(Number(style.minHeight) + trim.top + trim.bottom).toBeCloseTo(resolveLineHeight(16, 1.5), 10)
  })

  it('lifts the ink by as much as the box lost off its top', () => {
    const editor = board('vertical-trim-lift')
    const shape = textShape(editor, 'lifted')
    setTextShapeType(editor, shape, { family: 'Probe Lift', size: 16, lineHeight: 1.5, trim: 'cap' })

    const live = editor.getShape(shape.id) as TLTextShape
    const trim = textTrim(textShapeType(editor, live))!
    const painted = Number(paintedStyle(editor, live).marginTop)

    expect(painted).toBeLessThan(0)
    expect(-painted).toBeCloseTo(trim.top, 10)
  })

  it('lifts it by the same share of a shape that has been scaled', () => {
    const editor = board('vertical-trim-scaled')
    const shape = textShape(editor, 'scaled', { scale: 2 })
    setTextShapeType(editor, shape, { family: 'Probe Scale', size: 16, lineHeight: 1.5, trim: 'cap' })

    const live = editor.getShape(shape.id) as TLTextShape
    const trim = textTrim(textShapeType(editor, live))!
    const style = paintedStyle(editor, live)

    expect(style.marginTop).toBeCloseTo(-trim.top * 2, 10)
    expect(Number(style.minHeight) * 2).toBeCloseTo(editor.getShapeGeometry(live).bounds.h, 10)
  })

  it('paints no offset at all while it is standard', () => {
    const editor = board('vertical-trim-standard-paint')
    const shape = textShape(editor, 'standard')
    setTextShapeType(editor, shape, { family: 'Probe Standard', size: 16, lineHeight: 1.5 })

    const live = editor.getShape(shape.id) as TLTextShape
    expect(paintedStyle(editor, live).marginTop).toBeUndefined()
  })
})
