import { act, cleanup, render } from '@testing-library/react'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CrewCanvas } from '../src/renderer/src/canvas/CrewCanvas'
import { Editor } from '../src/renderer/src/canvas/editor'
import {
  createShapeId,
  createTLStore,
  fromPlainText,
  getSnapshot,
  loadSnapshot,
  renderHtmlFromRichTextForMeasurement
} from '../src/renderer/src/canvas/schema'
import { resolveLineHeight, richTextForMeasurement } from '../src/renderer/src/canvas/text'
import type { TLTextShape } from '../src/renderer/src/canvas'
import { DesignTextUtil } from '../src/renderer/src/design/TextUtil'
import { setTextShapeType, textShapeType } from '../src/renderer/src/design/textType'

const globalKeys = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLCanvasElement',
  'SVGElement',
  'Element',
  'Node',
  'MutationObserver',
  'ResizeObserver',
  'getSelection',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT'
] as const

const originalGlobals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const))
const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (
  html: string,
  options: { pretendToBeVisual: boolean }
) => { window: Window & typeof globalThis }

let dom: { window: Window & typeof globalThis }

function setGlobal(key: (typeof globalKeys)[number], value: unknown): void {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}

beforeAll(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
  const view = dom.window
  setGlobal('window', view)
  setGlobal('document', view.document)
  setGlobal('navigator', view.navigator)
  setGlobal('HTMLElement', view.HTMLElement)
  setGlobal('HTMLCanvasElement', view.HTMLCanvasElement)
  setGlobal('SVGElement', view.SVGElement)
  setGlobal('Element', view.Element)
  setGlobal('Node', view.Node)
  setGlobal('MutationObserver', view.MutationObserver)
  setGlobal('getSelection', view.getSelection.bind(view))
  setGlobal('getComputedStyle', view.getComputedStyle.bind(view))
  setGlobal('requestAnimationFrame', view.requestAnimationFrame.bind(view))
  setGlobal('cancelAnimationFrame', view.cancelAnimationFrame.bind(view))
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  setGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback([], this as unknown as ResizeObserver)
      }
      disconnect(): void {}
      unobserve(): void {}
    }
  )
  const rect = { x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}) }
  Object.defineProperty(view.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect })
  Object.defineProperty(view.Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(view.Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect })
  Object.defineProperty(view.Element.prototype, 'getClientRects', { configurable: true, value: () => [] })
})

afterAll(() => {
  dom.window.close()
  for (const key of globalKeys) {
    const descriptor = originalGlobals.get(key)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function drawingContext(): CanvasRenderingContext2D {
  const noop = vi.fn()
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, key) => (key === 'canvas' ? undefined : noop)
  })
}

const textId = createShapeId('typography-probe-text')

function mountBoard(): { view: ReturnType<typeof render>; editor: () => Editor } {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext())
  const store = createTLStore({ id: 'design-typography-probe' })
  let made: Editor | undefined
  const onMount = (subject: Editor) => {
    made = subject
    subject.createShapes([
      {
        id: textId,
        type: 'text',
        x: 40,
        y: 40,
        props: {
          color: 'black',
          size: 'm',
          w: 120,
          font: 'draw',
          textAlign: 'start',
          autoSize: true,
          scale: 1,
          richText: fromPlainText('Hello')
        }
      }
    ])
    return undefined
  }
  const view = render(createElement(CrewCanvas, { store, shapeUtils: [DesignTextUtil], onMount }))
  return { view, editor: () => made! }
}

function shapeOf(editor: Editor): TLTextShape {
  return editor.getShape(textId) as TLTextShape
}

function liveEditable(): HTMLElement {
  const box = dom.window.document.querySelector('[data-canvas-text-editor]')
  if (!box) throw new Error('no text editor is open')
  const editable = box.querySelector('[data-testid="canvas-rich-text-editor"]')
  if (!editable) throw new Error('no live editable inside the text editor')
  return editable as HTMLElement
}

describe('typography while a Design text shape is being edited', () => {
  it('carries letter spacing, case and decoration into the live editor', async () => {
    const { editor } = mountBoard()
    await act(async () => {
      editor().setEditingShape(textId)
    })
    await act(async () => {
      setTextShapeType(editor(), shapeOf(editor()), { spacing: 7, transform: 'upper', decoration: 'underline' })
    })

    const style = liveEditable().style
    expect(style.letterSpacing).toBe('7px')
    expect(style.textTransform).toBe('uppercase')
    expect(style.textDecoration).toBe('underline')
  })

  it('paints the same letter spacing whether or not the caret is open', async () => {
    const { editor } = mountBoard()
    await act(async () => {
      setTextShapeType(editor(), shapeOf(editor()), { spacing: 7 })
    })
    const painted = dom.window.document.querySelector('.crew-rich-text') as HTMLElement
    const paintedSpacing = painted.style.letterSpacing

    await act(async () => {
      editor().setEditingShape(textId)
    })
    expect(liveEditable().style.letterSpacing).toBe(paintedSpacing)
  })
})

describe('what a Design text shape is measured with', () => {
  it('paints the line height in the pixels it was measured in', async () => {
    const { editor } = mountBoard()
    await act(async () => {
      setTextShapeType(editor(), shapeOf(editor()), { size: 21, lineHeight: 1.4 })
    })
    const painted = dom.window.document.querySelector('.crew-rich-text') as HTMLElement
    expect(painted.style.lineHeight).toBe(`${resolveLineHeight(21, 1.4)}px`)
  })

  it('measures with the markup it paints', () => {
    const docs = [
      fromPlainText('Hello'),
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi', marks: [{ type: 'bold' }] }] }] },
      { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H' }] }] },
      {
        type: 'doc',
        content: [
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] }] }
        ]
      }
    ]
    for (const doc of docs) {
      expect(renderHtmlFromRichTextForMeasurement(doc as never)).toBe(richTextForMeasurement(doc as never))
    }
  })
})

function bareBoard(id: string): Editor {
  return new Editor({
    store: createTLStore({ id }),
    shapeUtils: [DesignTextUtil],
    getContainer: () => dom.window.document.body
  })
}

function spacingAwareRects(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const characters = this.textContent?.length ?? 0
    const spacing = Number.parseFloat(this.style.letterSpacing) || 0
    const width = characters * 10 + Math.max(0, characters - 1) * spacing
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 24, width, height: 24, toJSON: () => ({}) } as DOMRect
  })
}

describe('letter spacing on a Design text shape', () => {
  it('widens the bounding box the selection is drawn from', () => {
    spacingAwareRects()
    const editor = bareBoard('design-typography-probe-spacing')
    const id = createShapeId('spaced')
    editor.createShape({
      id,
      type: 'text',
      x: 0,
      y: 0,
      props: { autoSize: true, scale: 1, richText: fromPlainText('Hello') }
    })

    const tight = editor.getShapeGeometry(editor.getShape(id)!).bounds.w
    setTextShapeType(editor, editor.getShape(id) as TLTextShape, { spacing: 12 })
    const loose = editor.getShapeGeometry(editor.getShape(id)!).bounds.w

    expect(loose).toBeGreaterThan(tight)
  })
})

describe('dragging the edge of a Design text shape', () => {
  it('switches to a fixed width and keeps the scale', () => {
    const editor = bareBoard('design-typography-probe-resize')
    const id = createShapeId('draggable')
    editor.createShape({
      id,
      type: 'text',
      x: 0,
      y: 0,
      props: { autoSize: true, scale: 2, w: 100, richText: fromPlainText('Hello') }
    })
    const before = editor.getShapeGeometry(editor.getShape(id)!).bounds.w

    editor.resizeShape(id, { x: 2, y: 1 }, { dragHandle: 'right' })

    const after = editor.getShape(id) as TLTextShape
    expect(after.props.autoSize).toBe(false)
    expect(after.props.scale).toBe(2)
    expect(after.props.w).toBeCloseTo((before * 2) / 2, 5)
  })

  it('scales the shape from a corner instead of widening it', () => {
    const editor = bareBoard('design-typography-probe-corner')
    const id = createShapeId('corner')
    editor.createShape({
      id,
      type: 'text',
      x: 0,
      y: 0,
      props: { autoSize: true, scale: 1, richText: fromPlainText('Hello') }
    })

    editor.resizeShape(id, { x: 3, y: 3 }, { dragHandle: 'bottom_right' })

    const after = editor.getShape(id) as TLTextShape
    expect(after.props.autoSize).toBe(true)
    expect(after.props.scale).toBe(3)
  })
})

describe('typography settings on a Design text shape', () => {
  it('keeps every typography prop on the record after the edit session ends', async () => {
    const { editor } = mountBoard()
    await act(async () => {
      editor().setEditingShape(textId)
    })
    await act(async () => {
      setTextShapeType(editor(), shapeOf(editor()), {
        family: 'serif',
        size: 32,
        weight: 700,
        italic: true,
        spacing: 3,
        lineHeight: 1.6,
        transform: 'upper',
        decoration: 'underline'
      })
    })
    await act(async () => {
      editor().setEditingShape(null)
    })

    const type = textShapeType(editor(), shapeOf(editor()))
    expect(type).toMatchObject({
      family: 'serif',
      size: 32,
      weight: 700,
      italic: true,
      spacing: 3,
      lineHeight: 1.6,
      transform: 'upper',
      decoration: 'underline'
    })
  })

  it('keeps them through a store snapshot and back', async () => {
    const { editor } = mountBoard()
    await act(async () => {
      setTextShapeType(editor(), shapeOf(editor()), { family: 'mono', size: 21, weight: 600, spacing: 4 })
    })
    const snapshot = JSON.parse(JSON.stringify(getSnapshot(editor().store)))

    const store = createTLStore({ id: 'design-typography-probe-reload' })
    loadSnapshot(store, snapshot)
    const reloaded = new Editor({
      store,
      shapeUtils: [DesignTextUtil],
      getContainer: () => dom.window.document.body
    })

    const type = textShapeType(reloaded, reloaded.getShape(textId) as TLTextShape)
    expect(type).toMatchObject({ family: 'mono', size: 21, weight: 600, spacing: 4 })
  })
})
