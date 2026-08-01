import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor, type TLTextShape } from '../src/renderer/src/canvas'
import { createShapeId, createTLStore, fromPlainText } from '../src/renderer/src/canvas/schema'
import { DesignTextUtil } from '../src/renderer/src/design/TextUtil'
import { setTextShapeType, textShapeType } from '../src/renderer/src/design/textType'

const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (html: string) => {
  window: Window & typeof globalThis
}

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement')

function installDom(): void {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: dom.window.HTMLElement })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const characters = this.textContent?.length ?? 0
    const size = Number.parseFloat(this.style.fontSize) || 16
    const spacing = Number.parseFloat(this.style.letterSpacing) || 0
    const width = characters * size * 0.5 + Math.max(0, characters - 1) * spacing
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: size, width, height: size, toJSON: () => ({}) }
  })
}

function board(): Editor {
  return new Editor({
    store: createTLStore({ id: 'design-text-sticky' }),
    shapeUtils: [DesignTextUtil],
    getContainer: () => document.body
  })
}

function makeText(editor: Editor): { id: ReturnType<typeof createShapeId>; shape: TLTextShape } {
  const id = createShapeId('sticky-text')
  editor.createShape({
    id,
    type: 'text',
    x: 60,
    y: 40,
    props: { richText: fromPlainText('Crew'), autoSize: true, w: 8 }
  })
  return { id, shape: editor.getShape(id) as TLTextShape }
}

afterEach(() => {
  vi.restoreAllMocks()
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  if (originalHTMLElement) Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElement)
  else Reflect.deleteProperty(globalThis, 'HTMLElement')
})

describe('type on a text shape sticks', () => {
  it('keeps a change made from a panel that had not caught up yet', () => {
    installDom()
    const editor = board()
    const { id, shape } = makeText(editor)

    setTextShapeType(editor, shape, { family: 'Inter' })
    setTextShapeType(editor, shape, { size: 48 })

    const type = textShapeType(editor, editor.getShape(id) as TLTextShape)
    expect(type.family).toBe('Inter')
    expect(type.size).toBe(48)
  })

  it('keeps every field through a run of changes made off the same stale shape', () => {
    installDom()
    const editor = board()
    const { id, shape } = makeText(editor)

    setTextShapeType(editor, shape, { weight: 700 })
    setTextShapeType(editor, shape, { spacing: 3 })
    setTextShapeType(editor, shape, { lineHeight: 2 })
    setTextShapeType(editor, shape, { italic: true })

    const type = textShapeType(editor, editor.getShape(id) as TLTextShape)
    expect(type.weight).toBe(700)
    expect(type.spacing).toBe(3)
    expect(type.lineHeight).toBe(2)
    expect(type.italic).toBe(true)
  })

  it('reads the same type back after the shape has been let go of and picked up again', () => {
    installDom()
    const editor = board()
    const { id, shape } = makeText(editor)

    setTextShapeType(editor, shape, { family: 'Lora', size: 30 })
    editor.selectNone()
    editor.select(id)

    const type = textShapeType(editor, editor.getShape(id) as TLTextShape)
    expect(type.family).toBe('Lora')
    expect(type.size).toBe(30)
  })

  it('widens the box when the letters are spaced out', () => {
    installDom()
    const editor = board()
    const { id, shape } = makeText(editor)
    const before = editor.getShapePageBounds(id)!.width

    setTextShapeType(editor, shape, { spacing: 6 })

    expect(editor.getShapePageBounds(id)!.width).toBe(before + 18)
  })

  it('widens the box when the type is set larger', () => {
    installDom()
    const editor = board()
    const { id, shape } = makeText(editor)
    const before = editor.getShapePageBounds(id)!.width

    setTextShapeType(editor, shape, { size: 40 })

    expect(editor.getShapePageBounds(id)!.width).toBeGreaterThan(before)
  })

  it('leaves the shape where it stands when it is only moved', () => {
    installDom()
    const editor = board()
    const { id } = makeText(editor)

    editor.updateShape<TLTextShape>({ id, type: 'text', x: 200, y: 120 })

    const moved = editor.getShape(id) as TLTextShape
    expect(moved.x).toBe(200)
    expect(moved.y).toBe(120)
  })
})
