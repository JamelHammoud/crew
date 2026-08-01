import { createRequire } from 'node:module'
import { describe, it } from 'vitest'
import { richTextToHtml, type RichTextDocument } from '../src/renderer/src/canvas/text'
const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (h: string, o: { pretendToBeVisual: boolean }) => { window: Window & typeof globalThis }
describe('bench', () => {
  it('measures serializer cost', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
    for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node'] as const) {
      Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'window' ? dom.window : (dom.window as never)[k] })
    }
    const make = (n: number): RichTextDocument => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Label number ${n} on the board` }] }] })
    const cold = Array.from({ length: 200 }, (_, i) => make(i))
    let t0 = performance.now()
    for (const d of cold) richTextToHtml(d)
    const perCold = (performance.now() - t0) / cold.length
    const one = make(0)
    richTextToHtml(one)
    t0 = performance.now()
    for (let i = 0; i < 200; i++) richTextToHtml(one)
    const perWarm = (performance.now() - t0) / 200
    console.log(`uncached ${perCold.toFixed(3)} ms/call | cached ${perWarm.toFixed(4)} ms/call | 58 shapes repainting: ${(perCold * 58).toFixed(0)} ms -> ${(perWarm * 58).toFixed(1)} ms`)
  })
})
