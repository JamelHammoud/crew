import { b64Vecs } from '@tldraw/tlschema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nodeDefaults } from '../src/shared/designNode'
import {
  copyAs,
  snapshotToSvg,
  snapshotToSvgResult,
  TLDRAW_CUSTOM_PNG_MIME_TYPE,
  type ClipboardExportEditor
} from '../src/renderer/src/canvas/export'

const PAGE = { id: 'page:page', typeName: 'page', name: 'Page 1', index: 'a1', meta: {} }

function shape(id: string, type: string, props: Record<string, unknown>, x = 0, y = 0, parentId = PAGE.id) {
  return {
    id: `shape:${id}`,
    typeName: 'shape',
    type,
    x,
    y,
    rotation: 0,
    index: `a${id}`,
    parentId,
    isLocked: false,
    opacity: 1,
    props,
    meta: {}
  }
}

const richText = (text: string) => ({
  type: 'doc',
  content: text.split('\n').map(line => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] }))
})

const base = {
  color: 'blue',
  size: 'm',
  scale: 1
}

function allShapes() {
  const imageAsset = {
    id: 'asset:image',
    typeName: 'asset',
    type: 'image',
    props: { w: 80, h: 60, name: 'photo', isAnimated: false, mimeType: 'image/png', src: 'data:image/png;base64,AA==' },
    meta: {}
  }
  const bookmarkAsset = {
    id: 'asset:bookmark',
    typeName: 'asset',
    type: 'bookmark',
    props: { title: 'Crew', description: 'Shared work', image: '', favicon: '', src: 'https://crew.test' },
    meta: {}
  }
  const drawPath = b64Vecs.encodePoints2D([{ x: 0, y: 0 }, { x: 20, y: 10 }, { x: 40, y: 0 }])
  const records = [
    shape('01', 'geo', { ...base, geo: 'check-box', dash: 'solid', url: '', w: 100, h: 60, growY: 0, labelColor: 'black', fill: 'semi', font: 'sans', align: 'middle', verticalAlign: 'middle', richText: richText('Geo') }),
    shape('02', 'text', { ...base, font: 'sans', textAlign: 'start', w: 140, richText: richText('Text'), autoSize: true }, 120),
    shape('03', 'note', { ...base, color: 'yellow', labelColor: 'black', font: 'sans', fontSizeAdjustment: 1, align: 'middle', verticalAlign: 'middle', growY: 0, url: '', richText: richText('Note'), textLastEditedBy: null }, 280),
    shape('04', 'frame', { w: 240, h: 160, name: 'Frame', color: 'black' }, 500),
    shape('05', 'arrow', { ...base, kind: 'arc', labelColor: 'black', fill: 'none', dash: 'solid', arrowheadStart: 'none', arrowheadEnd: 'arrow', font: 'sans', start: { x: 0, y: 0 }, end: { x: 120, y: 40 }, bend: 20, richText: richText('Arrow'), labelPosition: 0.5, elbowMidPoint: 0.5 }, 0, 240),
    shape('06', 'line', { ...base, dash: 'dashed', spline: 'line', points: { a1: { id: 'a1', index: 'a1', x: 0, y: 0 }, a2: { id: 'a2', index: 'a2', x: 90, y: 30 } } }, 160, 240),
    shape('07', 'draw', { ...base, fill: 'none', dash: 'solid', segments: [{ type: 'free', path: drawPath, dim: 2 }], isComplete: true, isClosed: false, isPen: false, scaleX: 1, scaleY: 1 }, 300, 240),
    shape('08', 'highlight', { ...base, segments: [{ type: 'free', path: drawPath, dim: 2 }], isComplete: true, isPen: false, scaleX: 1, scaleY: 1 }, 380, 240),
    shape('09', 'design-node', { ...nodeDefaults(), w: 180, h: 100, text: 'Node', fills: [{ type: 'linear', angle: 90, stops: [{ color: '#141414', at: 0 }, { color: '#222222', at: 1 }], opacity: 1, visible: true }], strokes: [{ color: '#ffffff14', weight: 1, align: 'inside', style: 'solid', visible: true }], effects: [{ type: 'shadow', x: 0, y: 8, blur: 16, spread: 0, color: '#00000059', visible: true }], clip: true }, 480, 240),
    shape('10', 'image', { w: 80, h: 60, playing: false, url: '', assetId: imageAsset.id, crop: null, flipX: false, flipY: false, altText: 'Image' }, 700, 240),
    shape('11', 'video', { w: 80, h: 60, time: 0, playing: false, autoplay: false, url: '', assetId: imageAsset.id, altText: 'Video' }, 800, 240),
    shape('12', 'bookmark', { w: 180, h: 120, assetId: bookmarkAsset.id, url: 'https://crew.test' }, 900, 240),
    shape('13', 'embed', { w: 180, h: 120, url: 'https://example.test' }, 1100, 240),
    shape('14', 'group', {}, 1300, 240)
  ]
  records.push(shape('15', 'geo', { ...base, geo: 'ellipse', dash: 'solid', url: '', w: 40, h: 40, growY: 0, labelColor: 'black', fill: 'solid', font: 'sans', align: 'middle', verticalAlign: 'middle', richText: richText('') }, 10, 10, 'shape:14'))
  return { store: Object.fromEntries([[PAGE.id, PAGE], [imageAsset.id, imageAsset], [bookmarkAsset.id, bookmarkAsset], ...records.map(record => [record.id, record])]), schema: null }
}

describe('canvas snapshot SVG export', () => {
  it('draws every shape type accepted by the owned canvas schema', () => {
    const svg = snapshotToSvg(allShapes(), { padding: 0 })
    expect(svg).not.toBeNull()
    for (const type of ['geo', 'text', 'note', 'frame', 'arrow', 'line', 'draw', 'highlight', 'design-node', 'image', 'video', 'bookmark', 'embed', 'group']) {
      expect(svg).toContain(`data-shape-type="${type}"`)
    }
    expect(svg).toContain('linearGradient id="node-fill-shape_09-0"')
    expect(svg).toContain('filter id="node-effect-shape_09"')
    expect(svg).toContain('clipPath id="export-clip-shape_09"')
    expect(svg).toContain('data:image/png;base64,AA==')
    expect(svg).toContain('M0 0 L20 10 L40 0')
    expect(svg).toContain('marker-end="url(#arrow-end-shape_05)"')
  })

  it('keeps nested transforms, selection descendants, hidden records, and exact bounds', () => {
    const parent = shape('parent', 'design-node', { ...nodeDefaults(), w: 100, h: 80, clip: true }, 100, 20)
    const child = shape('child', 'geo', { ...base, geo: 'rectangle', dash: 'solid', url: '', w: 20, h: 10, growY: 0, labelColor: 'black', fill: 'solid', font: 'sans', align: 'middle', verticalAlign: 'middle', richText: richText('') }, 5, 6, parent.id)
    const hidden = { ...shape('hidden', 'geo', { ...child.props, w: 500, h: 500 }, 900), meta: { hidden: true } }
    const document = { store: { [PAGE.id]: PAGE, [parent.id]: parent, [child.id]: child, [hidden.id]: hidden }, schema: null }
    const result = snapshotToSvgResult(document, { shapeIds: [child.id], padding: 0 })
    expect(result?.svg).toContain('transform="matrix(1 0 0 1 105 26)"')
    expect(result?.svg).not.toContain('shape:hidden')
    expect(result?.bounds).toEqual({ x: 101.5, y: 22.5, w: 27, h: 17 })

    const parentResult = snapshotToSvg(document, { shapeIds: [parent.id], padding: 0 })
    expect(parentResult).toContain('data-shape-id="shape:child"')
    expect(parentResult).toContain('clip-path="url(#export-clip-shape_parent)"')
  })

  it('uses a mask node as a clip without painting the mask itself', () => {
    const mask = shape('mask', 'design-node', { ...nodeDefaults(), shape: 'ellipse', mask: true, clip: true }, 10, 10)
    const child = shape('masked', 'geo', { ...base, geo: 'rectangle', dash: 'solid', url: '', w: 300, h: 200, growY: 0, labelColor: 'black', fill: 'solid', font: 'sans', align: 'middle', verticalAlign: 'middle', richText: richText('') }, 0, 0, mask.id)
    const svg = snapshotToSvg({ store: { [PAGE.id]: PAGE, [mask.id]: mask, [child.id]: child } }, { padding: 0 })!
    const maskGroup = svg.slice(svg.indexOf('data-shape-id="shape:mask"'))
    expect(maskGroup).toContain('clip-path="url(#export-clip-shape_mask)"')
    expect(maskGroup.indexOf('<path d="M0 60')).toBeLessThan(0)
    expect(maskGroup).toContain('data-shape-id="shape:masked"')
  })
})

class FakeClipboardItem {
  static supports = vi.fn(() => true)
  types: Record<string, Promise<Blob> | Blob>

  constructor(types: Record<string, Promise<Blob> | Blob>) {
    this.types = types
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  FakeClipboardItem.supports.mockClear()
})

describe('canvas copyAs', () => {
  it('hands SVG to the clipboard synchronously as text/plain', async () => {
    const image = deferred<{ blob: Blob; width: number; height: number }>()
    const toImage = vi.fn(() => image.promise)
    const write = vi.fn(() => Promise.resolve())
    const editor = {
      getCurrentPageShapeIds: () => ['shape:one'],
      getSvgString: vi.fn(),
      toImage
    } as unknown as ClipboardExportEditor
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    vi.stubGlobal('navigator', { clipboard: { write } })

    const copied = copyAs(editor, ['shape:one'], { format: 'svg', background: false })
    expect(toImage).toHaveBeenCalledWith(['shape:one'], expect.objectContaining({ format: 'svg', background: false }))
    expect(write).toHaveBeenCalledTimes(1)
    const item = write.mock.calls[0][0][0] as FakeClipboardItem
    expect(Object.keys(item.types)).toEqual(['text/plain'])

    image.resolve({ blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }), width: 10, height: 10 })
    await copied
    expect((await item.types['text/plain']).type).toBe('text/plain')
  })

  it('writes canonical and unsanitized PNG types from one render', async () => {
    const toImage = vi.fn(async () => ({ blob: new Blob(['png'], { type: 'image/png' }), width: 20, height: 10 }))
    const write = vi.fn(() => Promise.resolve())
    const editor = {
      getCurrentPageShapeIds: () => ['shape:one'],
      getSvgString: vi.fn(),
      toImage
    } as unknown as ClipboardExportEditor
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    vi.stubGlobal('navigator', { clipboard: { write } })

    await copyAs(editor, [], { format: 'png', pixelRatio: 2 })
    const item = write.mock.calls[0][0][0] as FakeClipboardItem
    expect(Object.keys(item.types)).toEqual(['image/png', TLDRAW_CUSTOM_PNG_MIME_TYPE])
    expect((await item.types['image/png']).type).toBe('image/png')
    expect((await item.types[TLDRAW_CUSTOM_PNG_MIME_TYPE]).type).toBe(TLDRAW_CUSTOM_PNG_MIME_TYPE)
    expect(toImage).toHaveBeenCalledTimes(1)
    expect(toImage).toHaveBeenCalledWith(['shape:one'], expect.objectContaining({ format: 'png', pixelRatio: 2 }))
  })

  it('falls back to SVG text when ClipboardItem writes are unavailable', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    const editor = {
      getCurrentPageShapeIds: () => ['shape:one'],
      getSvgString: vi.fn(async () => ({ svg: '<svg>owned</svg>', width: 10, height: 10 })),
      toImage: vi.fn()
    } as unknown as ClipboardExportEditor
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyAs(editor, ['shape:one'], { format: 'svg' })
    expect(writeText).toHaveBeenCalledWith('<svg>owned</svg>')
    expect(editor.toImage).not.toHaveBeenCalled()
    expect(() => copyAs(editor, ['shape:one'], { format: 'png' })).toThrow('Copy not supported')
  })

  it('retries with resolved blobs when a clipboard rejects promised values', async () => {
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('promises unsupported'))
      .mockResolvedValueOnce(undefined)
    const editor = {
      getCurrentPageShapeIds: () => ['shape:one'],
      getSvgString: vi.fn(),
      toImage: vi.fn(async () => ({ blob: new Blob(['png'], { type: 'image/png' }), width: 10, height: 10 }))
    } as unknown as ClipboardExportEditor
    vi.stubGlobal('ClipboardItem', FakeClipboardItem)
    vi.stubGlobal('navigator', { clipboard: { write } })

    await copyAs(editor, ['shape:one'], { format: 'png' })
    expect(write).toHaveBeenCalledTimes(2)
    const retry = write.mock.calls[1][0][0] as FakeClipboardItem
    expect(retry.types['image/png']).toBeInstanceOf(Blob)
  })
})
