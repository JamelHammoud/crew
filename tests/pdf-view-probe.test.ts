// @vitest-environment jsdom
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import PdfPreview from '../src/renderer/src/components/attachment/PdfPreview'
import { pdfBytes } from './helpers/pdf'

const WIDTH = 456
const HEIGHT = 700

class Watcher {
  constructor(private readonly told: (marks: { isIntersecting: boolean }[]) => void) {}
  observe(): void {
    this.told([{ isIntersecting: true }])
  }
  unobserve(): void {}
  disconnect(): void {}
}

class Sizer {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = Sizer as unknown as typeof ResizeObserver
global.IntersectionObserver = Watcher as unknown as typeof IntersectionObserver
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: WIDTH })
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: HEIGHT })

const find = (root: HTMLElement): HTMLInputElement | null =>
  root.ownerDocument.body.querySelector('input[placeholder="Find in this file"]')

const counted = (root: HTMLElement): string | null =>
  find(root)?.parentElement?.querySelector('span.tabular-nums')?.textContent ?? null

describe('a pdf in the panel', () => {
  let host: http.Server
  let url = ''

  beforeAll(async () => {
    const bytes = pdfBytes(['Crew pools agents', 'Second page here'])
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

  it('puts the words of every page in the page they belong to', async () => {
    const view = render(createElement(PdfPreview, { url, name: 'note.pdf' }))

    await waitFor(
      () => {
        const layers = view.container.querySelectorAll('[data-pdf-text]')
        expect(layers.length).toBe(2)
        expect(layers[0].textContent).toContain('Crew pools agents')
        expect(layers[1].textContent).toContain('Second page here')
      },
      { timeout: 10000 }
    )

    const spans = view.container.querySelectorAll('[data-pdf-text] span')
    expect(spans.length).toBeGreaterThan(1)
  })

  it('finds a word in the document', async () => {
    const view = render(createElement(PdfPreview, { url, name: 'note.pdf' }))
    await waitFor(
      () => expect(view.container.querySelector('[data-pdf-text]')?.textContent).toContain('pools'),
      { timeout: 10000 }
    )

    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    const bar = await waitFor(() => {
      const box = find(view.container)
      expect(box).toBeTruthy()
      return box as HTMLInputElement
    })

    fireEvent.change(bar, { target: { value: 'pools' } })
    await waitFor(() => expect(counted(view.container)).toBe('1/1'))

    fireEvent.change(bar, { target: { value: 'agents' } })
    await waitFor(() => expect(counted(view.container)).toBe('1/1'))

    fireEvent.change(bar, { target: { value: 'nothing like this' } })
    await waitFor(() => expect(counted(view.container)).toBe('0/0'))
  })

  it('leaves the page number out of what is searched', async () => {
    const view = render(createElement(PdfPreview, { url, name: 'note.pdf' }))
    await waitFor(() => expect(view.container.querySelectorAll('[data-pdf-text]').length).toBe(2), {
      timeout: 10000
    })

    const numbers = view.container.querySelectorAll('.pdf-page')
    expect(numbers.length).toBe(2)
    expect(Array.from(numbers, span => span.textContent)).toEqual(['', ''])
    expect(Array.from(numbers, span => span.getAttribute('data-page'))).toEqual(['1', '2'])
  })

  it('draws the pages inside the app zoom view', async () => {
    const view = render(createElement(PdfPreview, { url, name: 'note.pdf' }))
    await waitFor(() => expect(view.container.querySelector('[data-pdf]')).toBeTruthy())

    const frame = view.container.querySelector('[data-zoom-frame]') as HTMLElement
    const content = view.container.querySelector('[data-zoom-content]') as HTMLElement
    const scroller = view.container.querySelector('[data-pdf]') as HTMLElement
    expect(content.contains(scroller)).toBe(true)
    expect(content.style.transform).toContain('scale(1)')

    fireEvent.wheel(frame, { deltaY: -120, ctrlKey: true, clientX: 200, clientY: 300 })
    await waitFor(() => expect(content.style.transform).not.toContain('scale(1)'))
    expect(scroller.className).toContain('select-none')
    expect(scroller.getAttribute('data-pan')).toBe('')
  })

  it('leaves a plain wheel to the pages', async () => {
    const view = render(createElement(PdfPreview, { url, name: 'note.pdf' }))
    await waitFor(() => expect(view.container.querySelector('[data-pdf]')).toBeTruthy())

    const content = view.container.querySelector('[data-zoom-content]') as HTMLElement
    const scroller = view.container.querySelector('[data-pdf]') as HTMLElement
    fireEvent.wheel(scroller, { deltaY: 400 })
    expect(content.style.transform).toContain('scale(1)')
    expect(scroller.className).toContain('overflow-y-auto')
    expect(scroller.className).toContain('select-text')
  })
})
