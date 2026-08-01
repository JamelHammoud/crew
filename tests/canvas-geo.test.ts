import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DASHES,
  DEFAULT_FILLS,
  GEO_KINDS,
  type TLShape,
  type TLShapeId
} from '../src/renderer/src/canvas/schema'
import {
  FrameShapeUtil,
  GeoShapeUtil,
  LineShapeUtil,
  PathBuilder,
  defaultGeoTypeDefinitions,
  geoGeometry,
  geoPath,
  getGeoShapePath,
  getPerfectDashProps,
  rng,
  type ShapeEditor
} from '../src/renderer/src/canvas/shapes'

const editor: ShapeEditor = {}

function geo(props: Partial<TLShape<'geo'>['props']> = {}, id = 'shape:geo'): TLShape<'geo'> {
  const util = new GeoShapeUtil(editor)
  return {
    id: id as TLShapeId,
    typeName: 'shape',
    type: 'geo',
    x: 0,
    y: 0,
    rotation: 0,
    index: 'a1',
    parentId: 'page:page' as TLShape['parentId'],
    isLocked: false,
    opacity: 1,
    meta: {},
    props: { ...util.getDefaultProps(), w: 140, h: 90, ...props }
  } as TLShape<'geo'>
}

function markup(element: unknown): string {
  return renderToStaticMarkup(element as ReactElement)
}

describe('geo paths', () => {
  it('registers a definition for every geo kind in the schema', () => {
    for (const kind of GEO_KINDS) {
      expect(defaultGeoTypeDefinitions[kind], kind).toBeDefined()
      expect(typeof defaultGeoTypeDefinitions[kind].getPath, kind).toBe('function')
    }
  })

  it('draws every geo kind inside its own box', () => {
    for (const kind of GEO_KINDS) {
      const geometry = geoGeometry(kind, 140, 90)
      const bounds = geometry.bounds
      expect(bounds.w, kind).toBeGreaterThan(0)
      expect(bounds.h, kind).toBeGreaterThan(0)
      expect(bounds.minX, kind).toBeGreaterThanOrEqual(-0.5)
      expect(bounds.minY, kind).toBeGreaterThanOrEqual(-0.5)
      expect(bounds.maxX, kind).toBeLessThanOrEqual(140.5)
      expect(bounds.maxY, kind).toBeLessThanOrEqual(90.5)
      expect(geoPath(kind, 140, 90).toD(), kind).not.toEqual('')
    }
  })

  it('fills the box for the kinds that are meant to', () => {
    for (const kind of ['rectangle', 'ellipse', 'oval', 'diamond', 'triangle', 'x-box', 'check-box'] as const) {
      const bounds = geoGeometry(kind, 140, 90).bounds
      expect(Math.round(bounds.w), kind).toBe(140)
      expect(Math.round(bounds.h), kind).toBe(90)
    }
  })

  it('insets the slanted kinds by the shorter side', () => {
    const offset = Math.min(140 * 0.38, 90 * 0.38)
    const rhombus = geoPath('rhombus', 140, 90).getCommands()
    expect(rhombus[0].x).toBeCloseTo(offset)
    expect(rhombus[0].y).toBe(0)
    expect(rhombus[1].x).toBe(140)

    const trapezoid = geoPath('trapezoid', 140, 90).getCommands()
    expect(trapezoid[0].x).toBeCloseTo(offset)
    expect(trapezoid[1].x).toBeCloseTo(140 - offset)
  })

  it('points each arrow kind the way it is named', () => {
    const ox = Math.min(140, 90) * 0.38
    const oy = 90 * 0.16

    const right = geoPath('arrow-right', 140, 90).getCommands()
    expect(right[0]).toMatchObject({ x: 0, y: oy })
    expect(right.some(c => c.x === 140 && c.y === 45)).toBe(true)

    const left = geoPath('arrow-left', 140, 90).getCommands()
    expect(left[0]).toMatchObject({ x: ox, y: 0 })
    expect(left.some(c => c.x === 0 && c.y === 45)).toBe(true)

    const up = geoPath('arrow-up', 140, 90).getCommands()
    expect(up[0]).toMatchObject({ x: 70, y: 0 })

    const down = geoPath('arrow-down', 140, 90).getCommands()
    expect(down.some(c => c.x === 70 && c.y === 90)).toBe(true)
  })

  it('carries the tick inside a check box and the cross inside an x box', () => {
    const check = geoPath('check-box', 140, 90).getCommands()
    const moves = check.filter(command => command.type === 'move')
    expect(moves.length).toBe(2)
    expect(moves[1].opts?.geometry).toMatchObject({ isInternal: true, isFilled: false })

    const cross = geoPath('x-box', 140, 90, { dash: 'solid' }).getCommands()
    expect(cross.filter(command => command.type === 'move').length).toBe(3)

    const dashedCross = geoPath('x-box', 140, 90, { dash: 'dashed' }).getCommands()
    expect(dashedCross.filter(command => command.type === 'move').length).toBe(5)

    const noneCross = geoPath('x-box', 140, 90, { dash: 'none' }).getCommands()
    expect(noneCross.filter(command => command.type === 'move').length).toBe(1)
  })

  it('insets the x box diagonals by the stroke width in draw mode only', () => {
    const drawn = geoPath('x-box', 140, 90, { dash: 'draw', strokeWidth: 10 }).getCommands()
    const drawnDiagonal = drawn.filter(command => command.type === 'move')[1]
    expect(drawnDiagonal.x).toBeCloseTo(6.2)

    const solid = geoPath('x-box', 140, 90, { dash: 'solid', strokeWidth: 10 }).getCommands()
    const solidDiagonal = solid.filter(command => command.type === 'move')[1]
    expect(solidDiagonal.x).toBe(0)
  })

  it('draws a cloud out of arcs and keeps it the same for the same shape', () => {
    const first = getGeoShapePath(geo({ geo: 'cloud' }), 3.5).toD()
    const second = getGeoShapePath(geo({ geo: 'cloud' }), 3.5).toD()
    const other = getGeoShapePath(geo({ geo: 'cloud' }, 'shape:other'), 3.5).toD()
    expect(first).toEqual(second)
    expect(first).not.toEqual(other)
    expect(first).toContain('C')
  })

  it('draws a heart out of curves', () => {
    const commands = geoPath('heart', 140, 90).getCommands()
    expect(commands.filter(command => command.type === 'cubic').length).toBe(4)
  })
})

describe('geo painting', () => {
  it('paints a stroke for every dash style and nothing for none', () => {
    const util = new GeoShapeUtil(editor)

    const solid = markup(util.component(geo({ dash: 'solid' })))
    expect(solid).toContain('<path')
    expect(solid).not.toContain('stroke-dasharray')

    const dashed = markup(util.component(geo({ dash: 'dashed' })))
    expect(dashed).toContain('stroke-dasharray')

    const dotted = markup(util.component(geo({ dash: 'dotted' })))
    expect(dotted).toContain('stroke-dasharray')

    const drawn = markup(util.component(geo({ dash: 'draw' })))
    expect(drawn).toContain('<path')
    expect(drawn).toContain('Q')

    const none = markup(util.component(geo({ dash: 'none', fill: 'none' })))
    expect(none).not.toContain('<path')
  })

  it('paints a fill only when one was asked for', () => {
    const util = new GeoShapeUtil(editor)
    for (const fill of DEFAULT_FILLS) {
      const painted = markup(util.component(geo({ fill, dash: 'solid' })))
      if (fill === 'none') expect(painted).not.toContain('fill="#')
      else expect(painted, fill).toContain('fill="#')
    }
  })

  it('runs two passes of wobble for a drawn stroke and one for its fill', () => {
    const path = getGeoShapePath(geo({ geo: 'rectangle', dash: 'draw', fill: 'solid' }), 3.5)
    const stroke = path.toDrawD({ strokeWidth: 3.5, randomSeed: 'shape:geo', passes: 2 })
    const fill = path.toDrawD({ strokeWidth: 3.5, randomSeed: 'shape:geo', passes: 1, offset: 0, onlyFilled: true })
    expect(stroke.split('M').length - 1).toBe(2)
    expect(fill.split('M').length - 1).toBe(1)
  })

  it('keeps every dash style paintable for every geo kind', () => {
    const util = new GeoShapeUtil(editor)
    for (const kind of GEO_KINDS) {
      for (const dash of DEFAULT_DASHES) {
        expect(() => markup(util.component(geo({ geo: kind, dash, fill: 'solid' }))), `${kind} ${dash}`).not.toThrow()
      }
    }
  })

  it('gives the label a box of its own inside the shape', () => {
    const util = new GeoShapeUtil(editor)
    const withText = geo({ richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] } })
    const geometry = util.getGeometry(withText) as unknown as { children: { isLabel: boolean }[] }
    expect(geometry.children.length).toBe(2)
    expect(geometry.children[1].isLabel).toBe(true)
  })

  it('says it is filled so a click inside lands on it', () => {
    const util = new GeoShapeUtil(editor)
    for (const kind of GEO_KINDS) {
      const filled = util.getGeometry(geo({ geo: kind, fill: 'semi' })) as unknown as {
        children: { isFilled: boolean; distanceToPoint(point: { x: number; y: number }): number }[]
      }
      expect(filled.children[0].isFilled, kind).toBe(true)
      expect(filled.children[0].distanceToPoint({ x: 70, y: 45 }), kind).toBeLessThan(0)

      const hollow = util.getGeometry(geo({ geo: kind, fill: 'none' })) as unknown as {
        children: { isFilled: boolean }[]
      }
      expect(hollow.children[0].isFilled, kind).toBe(false)
    }
  })

  it('carries a label box a hollow shape can be grabbed by', () => {
    const util = new GeoShapeUtil(editor)
    const text = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Continue' }] }] }
    for (const fill of ['none', 'semi'] as const) {
      const geometry = util.getGeometry(geo({ fill, richText: text })) as unknown as {
        children: { isLabel: boolean; isPointInBounds(point: { x: number; y: number }): boolean }[]
      }
      const label = geometry.children.find(child => child.isLabel)
      expect(label, fill).toBeDefined()
      expect(label?.isPointInBounds({ x: 70, y: 45 }), fill).toBe(true)
    }
  })

  it('keeps the shape bounds off the label box', () => {
    const util = new GeoShapeUtil(editor)
    const bounds = util.getGeometry(geo()).bounds
    expect(Math.round(bounds.w)).toBe(140)
    expect(Math.round(bounds.h)).toBe(90)
  })
})

describe('frames', () => {
  it('clips whatever is put inside it', () => {
    const util = new FrameShapeUtil(editor)
    const frame = {
      id: 'shape:f' as TLShapeId,
      typeName: 'shape',
      type: 'frame',
      x: 0,
      y: 0,
      rotation: 0,
      index: 'a1',
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      meta: {},
      props: { ...util.getDefaultProps(), w: 300, h: 200, name: 'Home' }
    } as unknown as TLShape<'frame'>

    const clip = util.getClipPath(frame)
    expect(clip).toBeDefined()
    expect(clip?.map(point => [point.x, point.y])).toEqual([
      [0, 0],
      [300, 0],
      [300, 200],
      [0, 200]
    ])
  })

  it('can be grabbed by its name', () => {
    const util = new FrameShapeUtil(editor)
    const named = {
      id: 'shape:f' as TLShapeId,
      typeName: 'shape',
      type: 'frame',
      x: 0,
      y: 0,
      rotation: 0,
      index: 'a1',
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      meta: {},
      props: { ...util.getDefaultProps(), w: 300, h: 200, name: 'Home' }
    } as unknown as TLShape<'frame'>

    const geometry = util.getGeometry(named) as unknown as {
      children?: { isLabel: boolean; isPointInBounds(point: { x: number; y: number }): boolean }[]
    }
    const label = geometry.children?.find(child => child.isLabel)
    expect(label).toBeDefined()
    expect(label?.isPointInBounds({ x: 4, y: -12 })).toBe(true)
    expect(util.getText(named)).toBe('Home')
  })

  it('holds its name at one size however far the board is zoomed out', () => {
    const util = new FrameShapeUtil(editor)
    const named = {
      id: 'shape:f' as TLShapeId,
      typeName: 'shape',
      type: 'frame',
      x: 0,
      y: 0,
      rotation: 0,
      index: 'a1',
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      meta: {},
      props: { ...util.getDefaultProps(), w: 300, h: 200, name: 'Sign up flow' }
    } as unknown as TLShape<'frame'>

    const painted = markup(util.component(named))
    expect(painted).toContain('Sign up flow')
    expect(painted).toContain('var(--crew-scale, 1)')
    expect(painted).toContain('var(--crew-zoom, 1)')
    expect(painted).toContain('3.5')
  })

  it('keeps the frame bounds off its name', () => {
    const util = new FrameShapeUtil(editor)
    const named = {
      id: 'shape:f' as TLShapeId,
      typeName: 'shape',
      type: 'frame',
      x: 0,
      y: 0,
      rotation: 0,
      index: 'a1',
      parentId: 'page:page',
      isLocked: false,
      opacity: 1,
      meta: {},
      props: { ...util.getDefaultProps(), w: 300, h: 200, name: 'A very long frame name indeed' }
    } as unknown as TLShape<'frame'>
    const bounds = util.getGeometry(named).bounds
    expect(bounds.minY).toBe(0)
    expect(bounds.h).toBe(200)
  })
})

describe('lines', () => {
  it('paints every dash style, wobble included', () => {
    const util = new LineShapeUtil(editor)
    const line = (dash: TLShape<'line'>['props']['dash']) =>
      ({
        id: 'shape:l' as TLShapeId,
        typeName: 'shape',
        type: 'line',
        x: 0,
        y: 0,
        rotation: 0,
        index: 'a1',
        parentId: 'page:page',
        isLocked: false,
        opacity: 1,
        meta: {},
        props: {
          ...util.getDefaultProps(),
          dash,
          points: {
            a1: { id: 'a1', index: 'a1', x: 0, y: 0 },
            a2: { id: 'a2', index: 'a2', x: 60, y: 40 },
            a3: { id: 'a3', index: 'a3', x: 120, y: 0 }
          }
        }
      }) as unknown as TLShape<'line'>

    expect(markup(util.component(line('dashed')))).toContain('stroke-dasharray')
    expect(markup(util.component(line('dotted')))).toContain('stroke-dasharray')
    expect(markup(util.component(line('draw')))).toContain('Q')
    expect(markup(util.component(line('solid')))).not.toContain('stroke-dasharray')
    expect(markup(util.component(line('none')))).not.toContain('<path')
  })
})

describe('dash maths', () => {
  it('answers none for a solid or absent dash', () => {
    expect(getPerfectDashProps(100, 2, { style: 'none' })).toMatchObject({ strokeDasharray: 'none' })
    expect(getPerfectDashProps(100, 2, { forceSolid: true })).toMatchObject({ strokeDasharray: 'none' })
  })

  it('spaces dashes and dots differently', () => {
    const dashed = getPerfectDashProps(100, 2, { style: 'dashed' })
    const dotted = getPerfectDashProps(100, 2, { style: 'dotted' })
    expect(dashed.strokeDasharray).not.toEqual(dotted.strokeDasharray)
    expect(Number(dotted.strokeDasharray.split(' ')[0])).toBeLessThan(
      Number(dashed.strokeDasharray.split(' ')[0])
    )
  })

  it('holds a short line to one dash', () => {
    expect(getPerfectDashProps(4, 2, { style: 'dashed' }).strokeDasharray.split(' ')[1]).toBe('0')
  })
})

describe('path builder', () => {
  it('walks a line through points and closes it', () => {
    const path = PathBuilder.lineThroughPoints([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]).close()
    expect(path.toD()).toBe('M 0 0 L 10 0 L 10 10 Z')
  })

  it('turns an arc into curves', () => {
    const path = new PathBuilder().moveTo(0, 5).arcTo(5, 5, false, true, 0, 10, 5)
    expect(path.getCommands().every(command => command.type !== 'line')).toBe(true)
    expect(path.toD()).toContain('C')
  })

  it('leaves an unfilled run out of a filled path', () => {
    const path = new PathBuilder()
      .moveTo(0, 0, { geometry: { isFilled: true } })
      .lineTo(10, 0)
      .close()
      .moveTo(2, 2, { geometry: { isInternal: true, isFilled: false } })
      .lineTo(8, 8)
    expect(path.toD({ onlyFilled: true })).not.toContain('8 8')
    expect(path.toD()).toContain('8 8')
  })

  it('is the same wobble for the same seed', () => {
    const path = () =>
      new PathBuilder().moveTo(0, 0, { geometry: { isFilled: true } }).lineTo(50, 0).lineTo(50, 50).close()
    expect(path().toDrawD({ strokeWidth: 4, randomSeed: 'a' })).toBe(path().toDrawD({ strokeWidth: 4, randomSeed: 'a' }))
    expect(path().toDrawD({ strokeWidth: 4, randomSeed: 'a' })).not.toBe(
      path().toDrawD({ strokeWidth: 4, randomSeed: 'b' })
    )
  })
})

describe('seeded random', () => {
  it('gives the same run of numbers for the same seed', () => {
    const a = rng('seed')
    const b = rng('seed')
    const c = rng('other')
    const first = [a(), a(), a()]
    expect(first).toEqual([b(), b(), b()])
    expect(first).not.toEqual([c(), c(), c()])
    for (const value of first) expect(Math.abs(value)).toBeLessThanOrEqual(2)
  })
})
