import { describe, it } from 'vitest'
import { createTLStore, getSnapshot } from '../src/renderer/src/canvas'
import { snapshotToSvg, svgDataUrl } from '../src/renderer/src/canvas/export'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'
import { createShapeId } from '../src/renderer/src/canvas/schema'
import { Editor } from '../src/renderer/src/canvas/editor'
import { SelectTool } from '../src/renderer/src/canvas/tools'

describe('scratch preview', () => {
  it('draws an empty board and a full one', () => {
    const store = createTLStore({ id: 'preview', shapeUtils: designShapeUtils })
    const empty = getSnapshot(store).document
    const svgEmpty = snapshotToSvg(
      { store: empty.store, schema: empty.schema },
      { background: false, darkMode: false, padding: 24, preserveAspectRatio: 'xMidYMid meet' }
    )
    console.log('empty svg', svgEmpty === null ? 'null' : typeof svgEmpty, svgEmpty ? String(svgEmpty).slice(0, 60) : '')

    const editor = new Editor({
      store,
      shapeUtils: designShapeUtils,
      tools: [SelectTool],
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
    })
    editor.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
    editor.createShape({ id: createShapeId('a'), type: 'design-node', x: 0, y: 0, props: { w: 100, h: 60, name: 'a' } })
    const full = getSnapshot(store).document
    const svgFull = snapshotToSvg(
      { store: full.store, schema: full.schema },
      { background: false, darkMode: false, padding: 24, preserveAspectRatio: 'xMidYMid meet' }
    )
    console.log('full svg', svgFull ? String(svgFull).slice(0, 120) : 'null')
    console.log('data url', svgFull ? svgDataUrl(svgFull).slice(0, 60) : 'none')
  })
})
