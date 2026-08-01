import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Rectangle2d } from '../src/renderer/src/canvas/geometry'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import { encodePoints } from '../src/renderer/src/canvas/schema/points'
import {
  GEO_KINDS,
  SHAPE_PROPS,
  type TLBinding,
  type TLShape,
  type TLShapeId,
  type TLShapeType
} from '../src/renderer/src/canvas/schema'
import { DesignNodeUtil } from '../src/renderer/src/design/DesignNodeUtil'
import {
  ArrowBindingUtil,
  ArrowShapeUtil,
  DrawShapeUtil,
  FrameShapeUtil,
  GeoShapeUtil,
  GroupShapeUtil,
  HighlightShapeUtil,
  ImageShapeUtil,
  LineShapeUtil,
  NoteShapeUtil,
  ShapeUtil,
  TextShapeUtil,
  arrowGeometry,
  defaultBindingUtils,
  defaultShapeUtils,
  geoGeometry,
  getArrowTerminals,
  linePoints,
  segmentPoints,
  shapeColor,
  type ShapeEditor
} from '../src/renderer/src/canvas/shapes'

const base = {
  typeName: 'shape' as const,
  x: 0,
  y: 0,
  rotation: 0,
  index: 'a1' as TLShape['index'],
  parentId: 'page:page' as TLShape['parentId'],
  isLocked: false,
  opacity: 1,
  meta: {}
}

function shape<Type extends TLShapeType>(
  type: Type,
  props: TLShape<Type>['props'],
  id = `shape:${type}`
): TLShape<Type> {
  return { ...base, id: id as TLShapeId, type, props } as TLShape<Type>
}

function boundArrowEditor(arrow: TLShape, target: TLShape, bindings: TLBinding[]): ShapeEditor {
  const util = new GeoShapeUtil({} as ShapeEditor)
  const find = (id: unknown) => (id === arrow.id ? arrow : target)
  const of = (value: unknown) => (typeof value === 'string' ? find(value) : (value as TLShape))
  return {
    getBindingsFromShape: () => bindings,
    getShape: id => find(id),
    getShapeGeometry: value =>
      of(value).type === 'arrow'
        ? new Rectangle2d({ width: 1, height: 1, isFilled: false })
        : util.getGeometry(of(value) as TLShape<'geo'>),
    getShapePageTransform: value => {
      const found = of(value)
      return { applyToPoint: point => new Vec(point.x, point.y).rot(found.rotation).addXY(found.x, found.y) }
    },
    getPointInShapeSpace: (found, point) => new Vec(point.x - found.x, point.y - found.y).rot(-found.rotation),
    getShapePageBounds: value => {
      const found = of(value)
      const props = found.props as { w?: number; h?: number }
      return new Box(found.x, found.y, props.w ?? 1, props.h ?? 1)
    }
  }
}

const editor: ShapeEditor = {}

const JSDOM = createRequire(import.meta.url)('jsdom').JSDOM as new (
  html: string
) => { window: Window & typeof globalThis }
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
let dom: { window: Window & typeof globalThis }

beforeAll(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
})

afterAll(() => {
  dom.window.close()
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
})

describe('owned canvas shape utilities', () => {
  it('keeps shape code independent from upstream canvas packages', () => {
    const directory = path.join(__dirname, '..', 'src', 'renderer', 'src', 'canvas', 'shapes')
    const imports = readdirSync(directory).flatMap(file => {
      if (!/\.tsx?$/.test(file)) return []
      const source = readFileSync(path.join(directory, file), 'utf8')
      const packageNames = [`tld${'raw'}`, `@tl${'draw'}/`]
      return packageNames.filter(name => source.includes(`from '${name}`) || source.includes(`from "${name}`))
    })
    expect(imports).toEqual([])
  })

  it('provides the base behavior and configurable subclasses', () => {
    expect(GeoShapeUtil.prototype).toBeInstanceOf(ShapeUtil)
    const Configured = GeoShapeUtil.configure({ showTextOutline: false })
    const util = new Configured(editor)
    expect(util.options.showTextOutline).toBe(false)
    expect(util.canResize(shape('geo', util.getDefaultProps()))).toBe(true)
  })

  it('uses the owned prop contracts and installed defaults', () => {
    const entries = [
      ['text', TextShapeUtil],
      ['draw', DrawShapeUtil],
      ['geo', GeoShapeUtil],
      ['note', NoteShapeUtil],
      ['line', LineShapeUtil],
      ['frame', FrameShapeUtil],
      ['arrow', ArrowShapeUtil],
      ['highlight', HighlightShapeUtil],
      ['image', ImageShapeUtil],
      ['group', GroupShapeUtil],
      ['design-node', DesignNodeUtil]
    ] as const
    for (const [type, Constructor] of entries) {
      expect(Constructor.type).toBe(type)
      expect(Constructor.props).toBe(SHAPE_PROPS[type])
      const util = new Constructor(editor) as ShapeUtil
      expect(util.getDefaultProps()).toBeTruthy()
    }
    expect(new FrameShapeUtil(editor).getDefaultProps()).toEqual({ w: 320, h: 180, name: '', color: 'black' })
    expect(new ArrowShapeUtil(editor).getDefaultProps()).toMatchObject({
      kind: 'arc',
      bend: 0,
      elbowMidPoint: 0.5,
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow'
    })
    expect(new ImageShapeUtil(editor).getDefaultProps()).toEqual({
      w: 100,
      h: 100,
      assetId: null,
      playing: true,
      url: '',
      crop: null,
      flipX: false,
      flipY: false,
      altText: ''
    })
    expect(defaultShapeUtils.map(util => util.type)).toEqual([
      'text',
      'draw',
      'geo',
      'note',
      'line',
      'frame',
      'arrow',
      'highlight',
      'image',
      'group'
    ])
    expect(defaultBindingUtils).toEqual([ArrowBindingUtil])
  })

  it('builds finite geometry and render elements for every geo record kind', () => {
    const util = new GeoShapeUtil(editor)
    for (const geo of GEO_KINDS) {
      const record = shape('geo', { ...util.getDefaultProps(), geo, w: 140, h: 90 })
      const geometry = util.getGeometry(record)
      expect(geometry.vertices.length, geo).toBeGreaterThan(2)
      expect(Number.isFinite(geometry.bounds.w), geo).toBe(true)
      expect(Number.isFinite(geometry.bounds.h), geo).toBe(true)
      expect(geometry.bounds.w, geo).toBeGreaterThan(0)
      expect(geometry.bounds.h, geo).toBeGreaterThan(0)
      expect(isValidElement(util.component(record)), geo).toBe(true)
    }
    expect(geoGeometry('ellipse', 80, 40).bounds).toMatchObject({ w: 80, h: 40 })
    expect(geoGeometry('oval', 80, 40).bounds).toMatchObject({ w: 80, h: 40 })
  })

  it('supports straight, curved, elbow, and bound arrows', () => {
    const util = new ArrowShapeUtil(editor)
    const defaults = util.getDefaultProps()
    const straight = shape('arrow', { ...defaults, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } })
    const curved = shape('arrow', { ...straight.props, bend: 35 }, 'shape:curved')
    const elbow = shape(
      'arrow',
      { ...straight.props, kind: 'elbow', elbowMidPoint: 0.25, end: { x: 100, y: 80 } },
      'shape:elbow'
    )
    expect(arrowGeometry(editor, straight).vertices).toEqual(
      expect.arrayContaining([expect.objectContaining({ x: 0, y: 0 }), expect.objectContaining({ x: 100, y: 0 })])
    )
    expect(arrowGeometry(editor, curved).vertices.length).toBeGreaterThan(4)
    expect(arrowGeometry(editor, elbow).vertices).toEqual(
      expect.arrayContaining([expect.objectContaining({ x: 25, y: 0 }), expect.objectContaining({ x: 25, y: 80 })])
    )

    const binding: TLBinding<'arrow'> = {
      id: 'binding:start' as TLBinding<'arrow'>['id'],
      typeName: 'binding',
      type: 'arrow',
      fromId: straight.id,
      toId: 'shape:target' as TLShapeId,
      props: {
        terminal: 'start',
        normalizedAnchor: { x: 0.25, y: 0.75 },
        isExact: false,
        isPrecise: true,
        snap: 'edge'
      },
      meta: {}
    }
    const target = shape(
      'geo',
      { ...new GeoShapeUtil(editor).getDefaultProps(), w: 200, h: 100 },
      'shape:target'
    )
    const boundEditor: ShapeEditor = boundArrowEditor(straight, target, [binding])
    expect(getArrowTerminals(boundEditor, straight).start).toMatchObject({ x: 50, y: 75 })
    expect(new ArrowBindingUtil({}).getDefaultProps()).toEqual({
      isPrecise: false,
      isExact: false,
      normalizedAnchor: { x: 0.5, y: 0.5 },
      snap: 'none'
    })
  })

  it('preserves line, draw, and highlight point records', () => {
    const lineUtil = new LineShapeUtil(editor)
    const line = shape('line', {
      ...lineUtil.getDefaultProps(),
      spline: 'cubic',
      points: {
        a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
        a2: { id: 'a2', index: 'a2', x: 50, y: 80 },
        a3: { id: 'a3', index: 'a3', x: 100, y: 0 }
      }
    })
    expect(linePoints(line).map(point => [point.x, point.y])).toEqual([
      [0, 0],
      [50, 80],
      [100, 0]
    ])
    expect(lineUtil.getHandles(line).map(handle => handle.id)).toEqual(['a1', 'a2', 'a3'])
    expect(
      lineUtil.onHandleDrag(line, {
        handle: { ...lineUtil.getHandles(line)[1], x: 60, y: 90 },
        isPrecise: true,
        isCreatingShape: false,
        initial: line
      })
    ).toMatchObject({ props: { points: { a2: { x: 60, y: 90 } } } })
    expect(lineUtil.getGeometry(line).vertices.length).toBeGreaterThan(3)

    const encoded = encodePoints([
      { x: 5, y: 7, z: 0.2 },
      { x: 20, y: 30, z: 0.8 },
      { x: 40, y: 15, z: 0.5 }
    ])
    const segments = [{ type: 'free' as const, path: encoded }]
    expect(segmentPoints(segments).map(point => [point.x, point.y, point.z])).toEqual([
      [5, 7, expect.closeTo(0.2)],
      [20, 30, expect.closeTo(0.8)],
      [40, 15, expect.closeTo(0.5)]
    ])
    const drawUtil = new DrawShapeUtil(editor)
    const draw = shape('draw', { ...drawUtil.getDefaultProps(), segments, isComplete: true })
    const highlightUtil = new HighlightShapeUtil(editor)
    const highlight = shape('highlight', { ...highlightUtil.getDefaultProps(), segments, isComplete: true })
    expect(drawUtil.getGeometry(draw).bounds.w).toBeGreaterThan(0)
    expect(highlightUtil.getGeometry(highlight).bounds.h).toBeGreaterThan(0)
    expect(isValidElement(drawUtil.component(draw))).toBe(true)
    expect(isValidElement(highlightUtil.component(highlight))).toBe(true)
  })

  it('uses exact light and dark paint variants', () => {
    expect(shapeColor(editor, 'blue', 'solid')).toBe('#4465e9')
    expect(shapeColor(editor, 'blue', 'semi')).toBe('#dce1f8')
    expect(shapeColor(editor, 'yellow', 'noteFill')).toBe('#FED49A')
    expect(shapeColor({ getColorMode: () => 'dark' }, 'blue', 'solid')).toBe('#4f72fc')
    expect(shapeColor({ getColorMode: () => 'dark' }, 'yellow', 'highlightSrgb')).toBe('#d2b700')
    expect(shapeColor({ getColorMode: () => 'dark' }, 'black', 'frameFill')).toBe('#0c0c0c')
  })

  it('renders text, notes, frames, images, groups, and Crew design nodes', () => {
    const textUtil = new TextShapeUtil(editor)
    const text = shape('text', {
      ...textUtil.getDefaultProps(),
      richText: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Crew', marks: [{ type: 'bold' }] }] }]
      }
    })
    expect(textUtil.getText(text)).toBe('Crew')
    expect(textUtil.getGeometry(text).bounds.w).toBeGreaterThan(8)
    expect(isValidElement(textUtil.component(text))).toBe(true)
    expect(renderToStaticMarkup(textUtil.component(text) as ReactElement)).toContain('<strong>Crew</strong>')
    const editingText = new TextShapeUtil({ getEditingShapeId: () => text.id })
    expect(renderToStaticMarkup(editingText.component(text) as ReactElement)).toContain('visibility:hidden')

    const noteUtil = new NoteShapeUtil(editor)
    const note = shape('note', noteUtil.getDefaultProps())
    expect(noteUtil.getGeometry(note).bounds).toMatchObject({ w: 200, h: 200 })
    expect(isValidElement(noteUtil.component(note))).toBe(true)

    const frameUtil = new FrameShapeUtil(editor)
    const frame = shape('frame', frameUtil.getDefaultProps())
    expect(frameUtil.isFrameLike(frame)).toBe(true)
    expect(isValidElement(frameUtil.component(frame))).toBe(true)

    const imageUtil = new ImageShapeUtil(editor)
    const image = shape('image', imageUtil.getDefaultProps())
    expect(imageUtil.getGeometry(image).bounds).toMatchObject({ w: 100, h: 100 })
    expect(isValidElement(imageUtil.component(image))).toBe(true)

    const groupUtil = new GroupShapeUtil(editor)
    const group = shape('group', {})
    expect(groupUtil.getGeometry(group).bounds).toMatchObject({ w: 1, h: 1 })

    const designUtil = new DesignNodeUtil(editor)
    const design = shape('design-node', designUtil.getDefaultProps())
    expect(designUtil.getGeometry(design).bounds.w).toBe(design.props.w)
    expect(isValidElement(designUtil.component(design))).toBe(true)
  })
})
