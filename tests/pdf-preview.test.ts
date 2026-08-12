import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, type Canvas } from '@napi-rs/canvas'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { pdfBytes } from './helpers/pdf'

const words = ['Crew pools agents', 'Second page here']

const inked = (canvas: Canvas): number => {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  let dark = 0
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 200 && pixels[i + 1] < 200) dark++
  return dark
}

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

  it('opens the file the panel fetched and says how many pages it has', async () => {
    const answer = await fetch(url)
    expect(answer.ok).toBe(true)
    const data = new Uint8Array(await answer.arrayBuffer())

    const task = pdfjs.getDocument({ data })
    const doc = await task.promise
    expect(doc.numPages).toBe(words.length)
    await task.destroy()
  })

  it('paints the first page at the width it is given', async () => {
    const data = new Uint8Array(await (await fetch(url)).arrayBuffer())
    const task = pdfjs.getDocument({ data })
    const doc = await task.promise
    const page = await doc.getPage(1)

    const unit = page.getViewport({ scale: 1 })
    const width = 456
    const density = 2
    const viewport = page.getViewport({ scale: (width / unit.width) * density })
    expect(Math.round(viewport.width)).toBe(width * density)
    expect(viewport.height / viewport.width).toBeCloseTo(unit.height / unit.width)

    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise

    expect(inked(canvas)).toBeGreaterThan(100)
    await task.destroy()
  })

  it('hands over the words of each page', async () => {
    const data = new Uint8Array(await (await fetch(url)).arrayBuffer())
    const task = pdfjs.getDocument({ data })
    const doc = await task.promise

    for (const [at, line] of words.entries()) {
      const page = await doc.getPage(at + 1)
      const said = (await page.getTextContent()).items.map(item => ('str' in item ? item.str : '')).join(' ')
      expect(said).toContain(line)
    }
    await task.destroy()
  })

  it('is refused a file that is not a pdf', async () => {
    const task = pdfjs.getDocument({ data: new Uint8Array(Buffer.from('not a pdf at all')) })
    await expect(task.promise).rejects.toThrow()
    await task.destroy()
  })

  it('reads the build the window can run', () => {
    const view = fs.readFileSync('src/renderer/src/components/attachment/PdfPreview.tsx', 'utf8')
    expect(view).toContain("from 'pdfjs-dist/legacy/build/pdf.mjs'")
    expect(view).toContain("from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'")

    const modern = fs.readFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'utf8')
    const legacy = fs.readFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'utf8')
    expect(modern).toContain('toHex')
    expect(legacy).toContain('toHex||')
  })
})
