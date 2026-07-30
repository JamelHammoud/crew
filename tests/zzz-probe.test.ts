// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { pdfBytes } from './helpers/pdf'

describe('probe', () => {
  it('says where import.meta.url points and whether a doc opens', async () => {
    console.log('meta', import.meta.url)
    const here = import.meta.url
    console.log('worker', new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', here).href)
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', here).href
    const bytes = pdfBytes(['hello there'])
    try {
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
      console.log('pages', doc.numPages)
    } catch (e) {
      console.log('threw', String(e))
    }
    expect(true).toBe(true)
  })
})
