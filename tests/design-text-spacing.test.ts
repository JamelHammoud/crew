import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor, type TLTextShape } from '../src/renderer/src/canvas'
import { createShapeId, createTLStore, fromPlainText } from '../src/renderer/src/canvas/schema'
import { DesignTextUtil } from '../src/renderer/src/design/TextUtil'
import { setTextShapeType } from '../src/renderer/src/design/textType'

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

function board(): Editor {
  return new Editor({
    store: createTLStore({ id: 'design-text-spacing' }),
    shapeUtils: [DesignTextUtil],
    getContainer: () => document.body
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  if (originalHTMLElement) Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElement)
  else Reflect.deleteProperty(globalThis, 'HTMLElement')
})

describe('letter spacing on a Design text shape', () => {
  it('remeasures the automatic width with the same spacing that is painted', () => {
    installDom()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const characters = this.textContent?.length ?? 0
      const spacing = Number.parseFloat(this.style.letterSpacing) || 0
      const width = characters * 10 + Math.max(0, characters - 1) * spacing
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: 24,
        width,
        height: 24,
        toJSON: () => ({})
      }
    })

    const editor = board()
    const id = createShapeId('spaced-text')
    editor.createShape({
      id,
      type: 'text',
      props: { richText: fromPlainText('Crew'), autoSize: true, w: 8 },
      meta: { type: { spacing: 0 } }
    })
    const before = editor.getShapePageBounds(id)!.width
    const shape = editor.getShape(id) as TLTextShape

    setTextShapeType(editor, shape, { spacing: 4 })

    const updated = editor.getShape(id) as TLTextShape
    expect(updated.props.w).toBe(before + 12)
    expect(editor.getShapePageBounds(id)!.width).toBe(before + 12)
  })
})
