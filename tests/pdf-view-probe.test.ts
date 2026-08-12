// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { afterEach, describe, expect, it } from 'vitest'
import PdfPreview from '../src/renderer/src/components/attachment/PdfPreview'
import { pdfAssets } from '../src/renderer/src/components/attachment/pdfAssets'
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

const here = import.meta.url
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', here).href

const url = 'https://crew.test/note.pdf'
const bytes = pdfBytes(['Crew pools agents', 'Second page here'])
global.fetch = (async () => ({
  ok: true,
  arrayBuffer: async () => bytes.slice().buffer
})) as unknown as typeof fetch

const bar = (root: HTMLElement): HTMLInputElement | null =>
  root.ownerDocument.body.querySelector('input[placeholder="Find in this file"]')

const counted = (root: HTMLElement): string | null =>
  bar(root)?.parentElement?.querySelector('span.tabular-nums')?.textContent ?? null

const paper = (root: HTMLElement): HTMLElement => root.querySelector('[data-pdf-text]')?.parentElement as HTMLElement

const words = ['Crew pools agents', 'Second page here']

describe('a pdf in the panel', () => {
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

  it('stands the find bar in the top right corner', async () => {
    const root = await shown()
    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    const field = await waitFor(() => bar(root) as HTMLInputElement)
    expect(field.parentElement?.className).toContain('top-4')
    expect(field.parentElement?.className).toContain('right-4')
  })

  it('draws a page and nothing under it', async () => {
    const root = await shown()
    await waitFor(() => expect(root.querySelectorAll('[data-pdf-text]').length).toBe(words.length))

    expect(root.querySelector('[data-page]')).toBeNull()
    const column = root.querySelector('[data-pdf]')?.firstElementChild as HTMLElement
    expect(column.children.length).toBe(words.length)
  })

  it('grows the pages themselves when it is pinched', async () => {
    const root = await shown()
    const scroller = root.querySelector('[data-pdf]') as HTMLElement
    await waitFor(() => expect(paper(root).style.width).toBe(`${FIT}px`))

    fireEvent.wheel(scroller, { deltaY: -120, ctrlKey: true, clientX: 200, clientY: 300 })
    await waitFor(() => expect(parseFloat(paper(root).style.width)).toBeGreaterThan(FIT))
    expect(paper(root).style.height).not.toBe('0px')
  })

  it('leaves a plain wheel to the scroller, both ways', async () => {
    const root = await shown()
    const scroller = root.querySelector('[data-pdf]') as HTMLElement
    await waitFor(() => expect(paper(root).style.width).toBe(`${FIT}px`))

    fireEvent.wheel(scroller, { deltaY: 400, deltaX: 200 })
    expect(paper(root).style.width).toBe(`${FIT}px`)
    expect(scroller.className).toContain('overflow-auto')
    expect(scroller.className).toContain('select-text')
  })

  it('reads the page it is really given', () => {
    expect(pdfAssets().standardFontDataUrl).toBe(new URL('pdfjs/standard_fonts/', document.baseURI).href)
  })
})
