// @vitest-environment jsdom
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { pathToFileURL } from 'node:url'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import PdfPreview from '../src/renderer/src/components/attachment/PdfPreview'
import { PAGE_WIDTH, pdfBytes } from './helpers/pdf'

const PANEL = 456
const PAD = 12
const FIT = PANEL - PAD * 2

class Blind {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = Blind as unknown as typeof ResizeObserver
global.IntersectionObserver = Blind as unknown as typeof IntersectionObserver
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: PANEL })
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 700 })

const measured = (text: string) => ({
  width: text.length * 6,
  fontBoundingBoxAscent: 8,
  fontBoundingBoxDescent: 2,
  actualBoundingBoxAscent: 8,
  actualBoundingBoxDescent: 2
})

HTMLCanvasElement.prototype.getContext = function measuring(this: HTMLCanvasElement) {
  return { canvas: this, font: '', measureText: measured }
} as never

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'
).href

const bar = (root: HTMLElement): HTMLInputElement | null =>
  root.ownerDocument.body.querySelector('input[placeholder="Find in this file"]')

const counted = (root: HTMLElement): string | null =>
  bar(root)?.parentElement?.querySelector('span.tabular-nums')?.textContent ?? null

const words = ['Crew pools agents', 'Second page here']

describe('a pdf in the panel', () => {
  let host: http.Server
  let url = ''

  beforeAll(async () => {
    const bytes = pdfBytes(words)
    host = http.createServer((_, answer) => {
      answer.writeHead(200, { 'content-type': 'application/pdf' })
      answer.end(Buffer.from(bytes))
    })
    await new Promise<void>(done => host.listen(0, '127.0.0.1', done))
    url = `http://127.0.0.1:${(host.address() as AddressInfo).port}/note.pdf`
  })

  afterAll(async () => {
    await new Promise<void>(done => host.close(() => done()))
  })

  afterEach(cleanup)

  const shown = async (): Promise<HTMLElement> => {
    const view = render(createElement(PdfPreview, { url, name: 'note.pdf' }))
    await waitFor(() => expect(view.container.querySelector('[data-pdf]')).toBeTruthy())
    return view.container
  }

  it('puts the words of a page into the page they belong to', async () => {
    const root = await shown()

    await waitFor(() => {
      const layers = root.querySelectorAll('[data-pdf-text]')
      expect(layers.length).toBe(words.length)
      expect(layers[0].textContent).toContain(words[0])
      expect(layers[1].textContent).toContain(words[1])
    })

    expect(root.querySelectorAll('[data-pdf-text] span').length).toBeGreaterThan(1)
    const layer = root.querySelector('[data-pdf-text]') as HTMLElement
    expect(layer.style.getPropertyValue('--total-scale-factor')).toBe(String(FIT / PAGE_WIDTH))
  })

  it('finds a word in the document', async () => {
    const root = await shown()
    await waitFor(() => expect(root.querySelector('[data-pdf-text]')?.textContent).toContain('pools'))

    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    const field = await waitFor(() => {
      const found = bar(root)
      expect(found).toBeTruthy()
      return found as HTMLInputElement
    })

    fireEvent.change(field, { target: { value: 'pools' } })
    await waitFor(() => expect(counted(root)).toBe('1/1'))

    fireEvent.change(field, { target: { value: 'of' } })
    await waitFor(() => expect(counted(root)).toBe('1/2'))

    fireEvent.change(field, { target: { value: 'nothing of the sort' } })
    await waitFor(() => expect(counted(root)).toBe('0/0'))
  })

  it('keeps the page number out of what is searched', async () => {
    const root = await shown()
    await waitFor(() => expect(root.querySelectorAll('[data-pdf-text]').length).toBe(words.length))

    const numbers = root.querySelectorAll('.pdf-page')
    expect(Array.from(numbers, span => span.textContent)).toEqual(['', ''])
    expect(Array.from(numbers, span => span.getAttribute('data-page'))).toEqual(['1', '2'])
  })

  it('draws the pages inside the app zoom view', async () => {
    const root = await shown()
    const frame = root.querySelector('[data-zoom-frame]') as HTMLElement
    const content = root.querySelector('[data-zoom-content]') as HTMLElement
    const scroller = root.querySelector('[data-pdf]') as HTMLElement

    expect(content.contains(scroller)).toBe(true)
    expect(content.style.transform).toContain('scale(1)')

    fireEvent.wheel(frame, { deltaY: -120, ctrlKey: true, clientX: 200, clientY: 300 })
    await waitFor(() => expect(content.style.transform).not.toContain('scale(1)'))
    expect(scroller.getAttribute('data-pan')).toBe('')
    expect(scroller.className).toContain('select-none')
  })

  it('leaves a plain wheel to the pages themselves', async () => {
    const root = await shown()
    const content = root.querySelector('[data-zoom-content]') as HTMLElement
    const scroller = root.querySelector('[data-pdf]') as HTMLElement

    fireEvent.wheel(scroller, { deltaY: 400 })
    expect(content.style.transform).toContain('scale(1)')
    expect(scroller.className).toContain('overflow-y-auto')
    expect(scroller.className).toContain('select-text')
  })
})
