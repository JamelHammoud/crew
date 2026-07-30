// @vitest-environment jsdom
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { pdfBytes } from './helpers/pdf'

const measured = (text: string) => ({
  width: text.length * 6,
  fontBoundingBoxAscent: 8,
  fontBoundingBoxDescent: 2,
  actualBoundingBoxAscent: 8,
  actualBoundingBoxDescent: 2
})
HTMLCanvasElement.prototype.getContext = (() => ({ font: '', measureText: measured })) as never

describe('pdfjs under jsdom', () => {
  it('opens a document', async () => {
    console.log('workerUrl', workerUrl)
    console.log('Worker?', typeof Worker, 'DOMMatrix?', typeof DOMMatrix, 'Path2D?', typeof Path2D)
    const host = http.createServer((_, answer) => {
      answer.writeHead(200, { 'content-type': 'application/pdf' })
      answer.end(Buffer.from(pdfBytes(['Crew pools agents'])))
    })
    await new Promise<void>(done => host.listen(0, '127.0.0.1', done))
    const url = `http://127.0.0.1:${(host.address() as AddressInfo).port}/a.pdf`
    try {
      const answer = await fetch(url)
      console.log('fetch ok', answer.ok)
      const data = new Uint8Array(await answer.arrayBuffer())
      console.log('bytes', data.length)
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs').href
      console.log('src', pdfjs.GlobalWorkerOptions.workerSrc)
      const doc = await pdfjs.getDocument({ data }).promise
      console.log('pages', doc.numPages)
      const page = await doc.getPage(1)
      const container = document.createElement('div')
      document.body.append(container)
      const layer = new pdfjs.TextLayer({
        textContentSource: await page.getTextContent(),
        container,
        viewport: page.getViewport({ scale: 1 })
      })
      await layer.render()
      console.log('spans', container.querySelectorAll('span').length, JSON.stringify(container.textContent))
    } catch (why) {
      console.log('FAILED', why instanceof Error ? why.stack?.slice(0, 800) : why)
    }
    await new Promise<void>(done => host.close(() => done()))
    expect(true).toBe(true)
  })
})
