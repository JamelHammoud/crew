import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CrewCanvas } from '../src/renderer/src/canvas/CrewCanvas'
import type { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, TextShapeUtil } from '../src/renderer/src/canvas/shapes'
const keys = ['window','document','navigator','HTMLElement','HTMLCanvasElement','SVGElement','Element','Node','MutationObserver','ResizeObserver','getSelection','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'] as const
const orig = new Map(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const))
const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as never as new (h: string, o: { pretendToBeVisual: boolean }) => { window: Window & typeof globalThis }
let dom: { window: Window & typeof globalThis }
const set = (k: (typeof keys)[number], v: unknown) => Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v })
beforeAll(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
  const w = dom.window
  set('window', w); set('document', w.document); set('navigator', w.navigator); set('HTMLElement', w.HTMLElement)
  set('HTMLCanvasElement', w.HTMLCanvasElement); set('SVGElement', w.SVGElement); set('Element', w.Element); set('Node', w.Node)
  set('MutationObserver', w.MutationObserver); set('getSelection', w.getSelection.bind(w))
  set('requestAnimationFrame', w.requestAnimationFrame.bind(w)); set('cancelAnimationFrame', w.cancelAnimationFrame.bind(w))
  set('IS_REACT_ACT_ENVIRONMENT', true)
  set('ResizeObserver', class { constructor(private cb: ResizeObserverCallback) {} observe() { this.cb([], this as never) } disconnect() {} unobserve() {} })
  const rect = { x:0,y:0,left:0,top:0,right:600,bottom:400,width:600,height:400,toJSON:()=>({}) }
  Object.defineProperty(w.HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: () => rect })
  Object.defineProperty(w.Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(w.Element.prototype, 'getClientRects', { configurable: true, value: () => [] })
})
afterAll(() => { dom.window.close(); for (const k of keys) { const d = orig.get(k); if (d) Object.defineProperty(globalThis, k, d); else Reflect.deleteProperty(globalThis, k) } })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const textId = createShapeId('t')
describe('diag', () => {
  it('reports the double click route', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({} as CanvasRenderingContext2D, { get: () => vi.fn() }))
    const store = createTLStore({ id: 'diag' })
    let ed: Editor | undefined
    const view = render(createElement(CrewCanvas, { store, shapeUtils: [TextShapeUtil, GeoShapeUtil], onMount: (s: Editor) => { ed = s; s.createShapes([{ id: textId, type: 'text', x: 40, y: 40, props: { color:'black', size:'m', w:120, font:'draw', textAlign:'start', autoSize:true, scale:1, richText: { type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:'Hello' }] }] } } }]); return undefined } }))
    await waitFor(() => expect(view.container.querySelectorAll('[data-canvas-shape="true"]')).toHaveLength(1))
    const e = ed!
    const bounds = e.getShapePageBounds(textId)!
    console.log('BOUNDS', JSON.stringify(bounds.toJson?.() ?? bounds))
    const centre = bounds.center
    const margin = (e.options.hitTestMargin as number) / e.getZoomLevel()

    console.log('--- UNSELECTED ---')
    console.log('overlayAtPoint', JSON.stringify(e.overlays.getOverlayAtPoint(centre, margin)?.id ?? null))
    console.log('selectedAtPoint', e.getSelectedShapeAtPoint(centre)?.id ?? null)
    console.log('shapeAtPoint hitInside false', e.getShapeAtPoint(centre, { margin, hitInside: false })?.id ?? null)
    console.log('shapeAtPoint hitInside true', e.getShapeAtPoint(centre, { margin, hitInside: true })?.id ?? null)

    act(() => { e.select(textId) })
    console.log('--- SELECTED ---')
    const ov = e.overlays.getOverlayAtPoint(centre, margin)
    console.log('overlayAtPoint', JSON.stringify(ov ? { id: ov.id, type: ov.type, handle: (ov.props as never as {handle?:string}).handle } : null))
    console.log('selectedAtPoint', e.getSelectedShapeAtPoint(centre)?.id ?? null)
    console.log('shapeAtPoint hitInside false', e.getShapeAtPoint(centre, { margin, hitInside: false })?.id ?? null)
    console.log('hoveredShape', e.getHoveredShape()?.id ?? null)

    console.log('--- ESCAPE ---')
    act(() => { e.setEditingShape(textId) })
    console.log('path while editing', (e.root.getCurrent() as { getPath(): string }).getPath())
    const canvas = view.container.querySelector('[data-canvas="true"]') as HTMLElement
    act(() => { canvas.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })) })
    console.log('editing after escape', e.getEditingShapeId())
    console.log('path after escape', (e.root.getCurrent() as { getPath(): string }).getPath())
    expect(true).toBe(true)
  })
})
