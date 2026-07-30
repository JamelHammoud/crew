import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, type Canvas } from '@napi-rs/canvas'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const pdfBytes = (): Uint8Array => {
  const stream = 'BT /F1 24 Tf 24 96 Td (Crew) Tj ET\n0 0 0 rg 24 24 120 40 re f\n'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 160] /Resources << /Font << /F1 6 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 160] /Resources << >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]

  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const size = objects.length + 1
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (const offset of offsets) table += `${String(offset).padStart(10, '0')} 00000 n \n`
  const file = `${body}${table}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF\n`
  return new Uint8Array(Buffer.from(file, 'latin1'))
}

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
    const bytes = pdfBytes()
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
    expect(doc.numPages).toBe(2)
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
    expect(Math.round(viewport.height)).toBe(Math.round(width * (unit.height / unit.width)) * density)

    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise

    expect(inked(canvas)).toBeGreaterThan(100)
    await task.destroy()
  })

  it('is refused a file that is not a pdf', async () => {
    const task = pdfjs.getDocument({ data: new Uint8Array(Buffer.from('not a pdf at all')) })
    await expect(task.promise).rejects.toThrow()
    await task.destroy()
  })
})
