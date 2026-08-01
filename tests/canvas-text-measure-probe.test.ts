import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TextMeasurement,
  richTextForMeasurement,
  richTextToHtml,
  richTextToPlainText,
  type RichTextDocument,
  type TextSpanMeasureOptions
} from '../src/renderer/src/canvas/text'

const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (
  html: string,
  options: { pretendToBeVisual: boolean }
) => { window: Window & typeof globalThis }

const GLOBAL_KEYS = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node'] as const

const originalGlobals = new Map(
  GLOBAL_KEYS.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
)

function setGlobal(key: (typeof GLOBAL_KEYS)[number], value: unknown): void {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
  const view = dom.window
  setGlobal('window', view)
  setGlobal('document', view.document)
  setGlobal('navigator', view.navigator)
  setGlobal('HTMLElement', view.HTMLElement)
  setGlobal('Element', view.Element)
  setGlobal('Node', view.Node)
  return dom
}

afterEach(() => {
  for (const key of GLOBAL_KEYS) {
    const descriptor = originalGlobals.get(key)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
  vi.restoreAllMocks()
})

const CHARACTER_WIDTH = 10
const LINE_HEIGHT = 18

function layOutOneCharacterPerRect(dom: { window: Window & typeof globalThis }, charactersPerLine: number): void {
  Object.defineProperty(dom.window.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) })
  })
  Object.defineProperty(dom.window.Range.prototype, 'getClientRects', {
    configurable: true,
    value(this: Range) {
      const text = this.startContainer.textContent ?? ''
      const index = this.startOffset
      let column = 0
      let line = 0
      for (let at = 0; at < index; at++) {
        if (text[at] === '\n' || column === charactersPerLine) {
          line += 1
          column = text[at] === '\n' ? 0 : 1
        } else column += 1
      }
      const left = column * CHARACTER_WIDTH
      const top = line * LINE_HEIGHT
      return [
        {
          x: left,
          y: top,
          left,
          top,
          right: left + CHARACTER_WIDTH,
          bottom: top + LINE_HEIGHT,
          width: CHARACTER_WIDTH,
          height: LINE_HEIGHT,
          toJSON: () => ({})
        }
      ]
    }
  })
}

const spanOptions: TextSpanMeasureOptions = {
  overflow: 'wrap',
  width: 200,
  height: 100,
  padding: 0,
  fontSize: 13,
  fontWeight: 'normal',
  fontFamily: 'Inter',
  fontStyle: 'normal',
  lineHeight: 1.35,
  textAlign: 'start'
}

describe('canvas text span measurement', () => {
  it('splits text into word and whitespace spans and restores the element styles', () => {
    const dom = installDom()
    layOutOneCharacterPerRect(dom, 100)
    const measurement = new TextMeasurement(dom.window.document, dom.window.document.body)
    const element = dom.window.document.body.firstElementChild as HTMLElement

    const spans = measurement.measureTextSpans('one two', spanOptions)

    expect(spans.map(span => span.text)).toEqual(['one', ' ', 'two'])
    expect(spans[0].box).toMatchObject({ x: 0, y: 0, w: 30 })
    expect(spans[1].box).toMatchObject({ x: 30, w: 10 })
    expect(spans[2].box).toMatchObject({ x: 40, w: 30 })
    expect(element.style.width).toBe('')
    expect(element.style.textAlign).toBe('')
    expect(element.style.lineHeight).toBe('')
    measurement.dispose()
  })

  it('starts a new span on every line and measures an empty line as a space', () => {
    const dom = installDom()
    layOutOneCharacterPerRect(dom, 100)
    const measurement = new TextMeasurement(dom.window.document, dom.window.document.body)

    const spans = measurement.measureTextSpans('ab\n\ncd', spanOptions)

    expect(spans.map(span => span.text)).toEqual(['ab', '\n \n', 'cd'])
    expect(spans[0].box.y).toBe(0)
    expect(spans[2].box.y).toBe(LINE_HEIGHT * 2)
    measurement.dispose()
  })

  it('measures nothing for empty text and honours the text alignment map', () => {
    const dom = installDom()
    layOutOneCharacterPerRect(dom, 100)
    const measurement = new TextMeasurement(dom.window.document, dom.window.document.body)
    const element = dom.window.document.body.firstElementChild as HTMLElement

    expect(measurement.measureTextSpans('', spanOptions)).toEqual([])

    const seen: string[] = []
    const realSetProperty = element.style.setProperty.bind(element.style)
    vi.spyOn(element.style, 'setProperty').mockImplementation((name: string, value: string | null) => {
      if (name === 'text-align' && value) seen.push(value)
      return realSetProperty(name, value)
    })
    measurement.measureTextSpans('x', { ...spanOptions, textAlign: 'middle' })
    measurement.measureTextSpans('x', { ...spanOptions, textAlign: 'end' })
    measurement.measureTextSpans('x', { ...spanOptions, textAlign: 'start-legacy' })

    expect(seen).toEqual(['center', 'right', 'left'])
    measurement.dispose()
  })

  it('truncates to the first line and appends an ellipsis span', () => {
    const dom = installDom()
    layOutOneCharacterPerRect(dom, 4)
    const measurement = new TextMeasurement(dom.window.document, dom.window.document.body)

    const spans = measurement.measureTextSpans('abcdefgh', {
      ...spanOptions,
      width: 40,
      overflow: 'truncate-ellipsis'
    })

    expect(spans[spans.length - 1].text).toBe('…')
    expect(spans.every(span => span.box.y === 0)).toBe(true)
    measurement.dispose()
  })
})

const HELLO: RichTextDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello crew' }] }]
}

describe('canvas rich text rendering', () => {
  beforeEach(() => {
    installDom()
  })

  it('renders every stored mark and both kinds of list', () => {
    const document: RichTextDocument = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'code', marks: [{ type: 'code' }] },
            { type: 'text', text: 'lit', marks: [{ type: 'highlight' }] },
            { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://crew.test' } }] }
          ]
        },
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }]
        },
        {
          type: 'orderedList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }] }]
        }
      ]
    }

    const html = richTextToHtml(document)

    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<mark')
    expect(html).toContain('lit</mark>')
    expect(html).toContain('href="https://crew.test"')
    expect(html).toContain('<ul>')
    expect(html).toContain('<ol>')
    expect(html.match(/<li>/g)).toHaveLength(2)
  })

  it('keeps an empty paragraph standing and wraps measurement html in the painted class', () => {
    const empty: RichTextDocument = { type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph' }] }
    expect(richTextToHtml(empty)).toBe('<p><br /></p><p><br /></p>')
    expect(richTextForMeasurement(HELLO)).toBe(`<div class="crew-rich-text">${richTextToHtml(HELLO)}</div>`)
  })

  it('serializes a document once and hands the same string back afterwards', () => {
    const first = richTextToHtml(HELLO)
    const second = richTextToHtml(HELLO)
    expect(second).toBe(first)

    const copy: RichTextDocument = JSON.parse(JSON.stringify(HELLO))
    expect(richTextToHtml(copy)).toBe(first)

    const plain = richTextToPlainText(HELLO)
    expect(richTextToPlainText(HELLO)).toBe(plain)
    expect(plain).toBe('Hello crew')
  })

  it('reads every empty document as empty rather than serializing it', () => {
    expect(richTextToPlainText({ type: 'doc', content: [] })).toBe('')
    expect(richTextToPlainText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('')
    expect(richTextToPlainText({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })).toBe('')
  })
})
