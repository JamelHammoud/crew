import { createRequire } from 'node:module'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Editor as TipTapEditor } from '@tiptap/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FontMeasurementCache,
  FontTracker,
  handleTextTab,
  RichTextEditor,
  TextMeasurement,
  compensateTextGrowth,
  measureTextLayout,
  normalizeLink,
  normalizeTextForMeasurement,
  resolveLineHeight,
  richTextFromHtml,
  richTextFromProseMirror,
  richTextToHtml,
  richTextToPlainText,
  richTextToProseMirror,
  richTextExtensions,
  runRichTextAction,
  setRichTextLink,
  screenPointToText,
  textPointToScreen,
  textTransformCss,
  type FontFaceSetLike,
  type RichTextDocument,
  type TextMeasureOptions
} from '../src/renderer/src/canvas/text'

const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (
  html: string,
  options: { pretendToBeVisual: boolean }
) => { window: Window & typeof globalThis }

const GLOBAL_KEYS = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'MutationObserver',
  'getSelection',
  'innerHeight',
  'innerWidth',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT'
] as const

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
  setGlobal('MutationObserver', view.MutationObserver)
  setGlobal('getSelection', view.getSelection.bind(view))
  setGlobal('innerHeight', 900)
  setGlobal('innerWidth', 1400)
  setGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0))
  setGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const emptyRect = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({})
  }
  Object.defineProperty(view.Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(view.Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => emptyRect })
  Object.defineProperty(view.Element.prototype, 'getClientRects', { configurable: true, value: () => [] })
  return dom
}

afterEach(() => {
  for (const key of GLOBAL_KEYS) {
    const descriptor = originalGlobals.get(key)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})

const baseMeasure = {
  fontStyle: 'normal',
  fontWeight: '500',
  fontFamily: 'Inter',
  fontSize: 13,
  lineHeight: 1.35,
  maxWidth: null,
  padding: '0px'
}

const { fontSize: _fontSize, maxWidth: _maxWidth, ...layoutMeasure } = baseMeasure

const rich: RichTextDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Crew ', marks: [{ type: 'bold' }] },
        {
          type: 'text',
          text: 'link',
          marks: [
            { type: 'italic' },
            {
              type: 'link',
              attrs: { href: 'https://crew.test', target: '_blank', rel: 'noopener noreferrer nofollow' }
            },
            { type: 'highlight', attrs: { color: null } }
          ]
        }
      ]
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Together', marks: [{ type: 'code' }] }] }]
        }
      ]
    }
  ]
}

describe('canvas text measurement', () => {
  it('normalizes lines and resolves whole-pixel line heights', () => {
    expect(normalizeTextForMeasurement('one\r\n\rthree')).toBe('one\n \nthree')
    expect(resolveLineHeight(13, 1.35)).toBe(18)
  })

  it('applies and restores measurement styles and supports batches', () => {
    const dom = installDom()
    const container = dom.window.document.body
    const sizes = new WeakMap<Element, { width: number; height: number }>()
    vi.spyOn(dom.window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const size = sizes.get(this) ?? { width: this.textContent?.length ?? 0, height: 18 }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: size.width,
        bottom: size.height,
        width: size.width,
        height: size.height,
        toJSON: () => ({})
      }
    })
    const measurement = new TextMeasurement(dom.window.document, container)
    const first = container.firstElementChild as HTMLElement
    sizes.set(first, { width: 44.5, height: 36 })
    const measured = measurement.measureHtml('<strong>hello</strong>', { ...baseMeasure, maxWidth: 80 })
    expect(measured).toMatchObject({ w: 44.5, h: 36 })
    expect(first.innerHTML).toBe('<strong>hello</strong>')
    expect(first.style.maxWidth).toBe('')
    expect(first.style.lineHeight).toBe('')
    const batch = measurement.measureHtmlBatch([
      { html: '<p>one</p>', options: baseMeasure },
      { html: '<p>two</p>', options: { ...baseMeasure, maxWidth: 40 } }
    ])
    expect(batch).toHaveLength(2)
    expect(container.querySelectorAll('.crew-text-measure')).toHaveLength(3)
    expect((container.lastElementChild as HTMLElement).style.maxWidth).toBe('40px')
    measurement.dispose()
    expect(container.querySelectorAll('.crew-text-measure')).toHaveLength(0)
  })
})

describe('canvas text fonts', () => {
  it('invalidates tracked measurements when relevant fonts settle', async () => {
    const target = new EventTarget()
    let finishReady: (() => void) | undefined
    const ready = new Promise<void>(resolve => {
      finishReady = resolve
    })
    const fonts: FontFaceSetLike = {
      ready,
      load: vi.fn(async () => []),
      addEventListener: (type, listener) => target.addEventListener(type, listener),
      removeEventListener: (type, listener) => target.removeEventListener(type, listener)
    }
    const tracker = new FontTracker(fonts)
    tracker.track(['Inter'])
    const cache = new FontMeasurementCache<object, number>(tracker)
    const key = {}
    const measure = vi.fn(() => 24)
    expect(cache.get(key, 'a', measure)).toBe(24)
    expect(cache.get(key, 'a', measure)).toBe(24)
    const unrelated = new Event('loadingdone') as Event & { fontfaces: Array<{ family: string }> }
    unrelated.fontfaces = [{ family: 'Other' }]
    target.dispatchEvent(unrelated)
    expect(cache.get(key, 'a', measure)).toBe(24)
    expect(measure).toHaveBeenCalledTimes(1)
    const loaded = new Event('loadingdone') as Event & { fontfaces: Array<{ family: string }> }
    loaded.fontfaces = [{ family: 'Inter' }]
    target.dispatchEvent(loaded)
    expect(cache.get(key, 'a', measure)).toBe(24)
    expect(measure).toHaveBeenCalledTimes(2)
    await tracker.load('500 13px Inter')
    expect(cache.get(key, 'a', measure)).toBe(24)
    expect(measure).toHaveBeenCalledTimes(3)
    finishReady?.()
    await ready
    await Promise.resolve()
    expect(tracker.generation).toBe(3)
    tracker.dispose()
  })
})

describe('canvas rich text', () => {
  it('round trips ProseMirror documents without dropping supported structure or marks', () => {
    installDom()
    const proseMirror = richTextToProseMirror(rich)
    const fromProseMirror = richTextFromProseMirror(proseMirror)
    expect(richTextToPlainText(fromProseMirror).replace(/\n+/g, '\n')).toBe('Crew link\nTogether')
    expect(fromProseMirror.content[0].content?.[0].marks?.map(mark => mark.type)).toEqual(['bold'])
    expect(fromProseMirror.content[1].type).toBe('bulletList')
    const html = richTextToHtml(rich)
    expect(html).toContain('<strong>Crew </strong>')
    expect(html).toContain('<ul dir="auto">')
    const roundTrip = richTextFromHtml(html)
    expect(richTextToPlainText(roundTrip).replace(/\n+/g, '\n')).toBe('Crew link\nTogether')
    const linkMarks = roundTrip.content[0].content?.[1].marks ?? []
    expect(linkMarks.map(mark => mark.type).sort()).toEqual(['highlight', 'italic', 'link'])
    expect(linkMarks.find(mark => mark.type === 'link')?.attrs?.href).toBe('https://crew.test')
  })
})

describe('canvas text autosizing', () => {
  it('uses fixed widths for wrapped text and adds wrapping room to automatic widths', () => {
    installDom()
    const measureHtml = vi.fn((_html: string, _options: TextMeasureOptions) => ({
      x: 0,
      y: 0,
      w: 33.4,
      h: 11,
      scrollWidth: 0
    }))
    const automatic = measureTextLayout(
      { measureHtml },
      { richText: rich, autoSize: true, width: 4, fontSize: 16, options: layoutMeasure }
    )
    expect(automatic).toEqual({ width: 34.4, height: 16 })
    expect(measureHtml.mock.calls[0][1].maxWidth).toBeNull()
    const fixed = measureTextLayout(
      { measureHtml },
      { richText: rich, autoSize: false, width: 91.8, fontSize: 16, options: layoutMeasure }
    )
    expect(fixed).toEqual({ width: 91, height: 16 })
    expect(measureHtml.mock.calls[1][1].maxWidth).toBe(91)
  })

  it('keeps aligned growth anchored through rotation and keeps content growth on its top edge', () => {
    const previous = {
      x: 100,
      y: 80,
      rotation: Math.PI / 2,
      scale: 2,
      autoSize: true,
      textAlign: 'end' as const,
      width: 20
    }
    const next = { ...previous, width: 20 }
    const content = compensateTextGrowth(previous, next, { width: 20, height: 10 }, { width: 30, height: 20 }, true)
    expect(content.x).toBeCloseTo(100)
    expect(content.y).toBeCloseTo(60)
    expect(content.width).toBe(30)
    const style = compensateTextGrowth(previous, next, { width: 20, height: 10 }, { width: 30, height: 20 }, false)
    expect(style.x).toBeCloseTo(110)
    expect(style.y).toBeCloseTo(60)
  })
})

describe('canvas transformed text editing', () => {
  it('maps points through the same transform applied to the contenteditable', async () => {
    const transform = { x: 80, y: 40, rotation: Math.PI / 4, scaleX: 2, scaleY: 0.5 }
    const local = { x: 12, y: 18 }
    const screen = textPointToScreen(local, transform)
    const restored = screenPointToText(screen, transform)
    expect(restored.x).toBeCloseTo(12)
    expect(restored.y).toBeCloseTo(18)
    expect(textTransformCss(transform)).toBe(`translate(80px, 40px) rotate(${Math.PI / 4}rad) scale(2, 0.5)`)

    const dom = installDom()
    const host = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(host)
    let root: Root | null = createRoot(host)
    let editor: import('@tiptap/core').Editor | null = null
    let changed: RichTextDocument | null = null
    await act(async () => {
      root?.render(
        createElement(RichTextEditor, {
          richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
          editing: true,
          transform,
          onChange: value => {
            changed = value
          },
          onReady: value => {
            editor = value
          }
        })
      )
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    const wrapper = host.querySelector('[data-testid="canvas-rich-text-editor"]') as HTMLElement
    expect(wrapper.style.transform).toBe(textTransformCss(transform))
    expect(host.querySelector('.ProseMirror')?.getAttribute('contenteditable')).toBe('true')
    await act(async () => {
      editor?.commands.focus('end')
      editor?.commands.insertContent(' crew')
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    expect(richTextToPlainText(changed!)).toBe('Hello crew')
    await act(async () => {
      root?.unmount()
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    root = null
  })
})

describe('canvas rich text toolbar', () => {
  it('normalizes links the same way the current Design editor does', () => {
    expect(normalizeLink(' crew.test ')).toBe('https://crew.test')
    expect(normalizeLink('https://crew.test')).toBe('https://crew.test')
    expect(normalizeLink('mailto:hello@crew.test')).toBe('https://mailto:hello@crew.test')
    expect(normalizeLink('   ')).toBe('')
  })

  it('runs every formatting command exposed by Design', () => {
    const dom = installDom()
    const actions = ['bold', 'italic', 'code', 'bulletList', 'highlight'] as const
    for (const action of actions) {
      const element = dom.window.document.createElement('div')
      dom.window.document.body.appendChild(element)
      const editor = new TipTapEditor({
        element,
        extensions: richTextExtensions,
        enableCoreExtensions: { textDirection: false },
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Crew' }] }] }
      })
      editor.commands.setTextSelection({ from: 1, to: 5 })
      expect(runRichTextAction(editor, action)).toBe(true)
      expect(editor.isActive(action)).toBe(true)
      editor.destroy()
      element.remove()
    }

    const element = dom.window.document.createElement('div')
    dom.window.document.body.appendChild(element)
    const editor = new TipTapEditor({
      element,
      extensions: richTextExtensions,
      enableCoreExtensions: { textDirection: false },
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Crew' }] }] }
    })
    editor.commands.setTextSelection({ from: 1, to: 5 })
    expect(setRichTextLink(editor, 'crew.test')).toBe(true)
    expect(editor.getAttributes('link').href).toBe('https://crew.test')
    expect(setRichTextLink(editor, '')).toBe(true)
    expect(editor.isActive('link')).toBe(false)
    editor.commands.setTextSelection(3)
    const tab = new dom.window.KeyboardEvent('keydown', { key: 'Tab', cancelable: true }) as unknown as KeyboardEvent
    expect(handleTextTab(editor, tab)).toBe(true)
    expect(editor.getText()).toBe('\tCrew')
    const untab = new dom.window.KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      cancelable: true
    }) as unknown as KeyboardEvent
    expect(handleTextTab(editor, untab)).toBe(true)
    expect(editor.getText()).toBe('Crew')
    editor.destroy()
    element.remove()
  })
})
