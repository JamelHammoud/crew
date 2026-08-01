import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Group2d } from '../src/renderer/src/canvas/geometry'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import { defaultShapeUtils, type ShapeEditor } from '../src/renderer/src/canvas/shapes'
import type { TLShape } from '../src/renderer/src/canvas/schema'

const FILE =
  '/Users/jamel/Library/Application Support/Crew/projects/8fe5a6ed2108672a/.crew/designs/untitled-6eto.json'
const saved = JSON.parse(readFileSync(FILE, 'utf8'))
const shapes = Object.values(saved.document?.store ?? {}).filter(
  (r: { typeName?: string }) => r.typeName === 'shape'
) as TLShape[]
const editor: ShapeEditor = {}
const utils = new Map(defaultShapeUtils.map(U => [U.type as string, new U(editor as never)]))

describe('the real board', () => {
  it('builds geometry and paint for every shape it holds', () => {
    const failures: string[] = []
    for (const shape of shapes) {
      const util = utils.get(shape.type)
      if (!util) continue
      try {
        const geometry = util.getGeometry(shape as never)
        if (!Number.isFinite(geometry.bounds.w) || !Number.isFinite(geometry.bounds.h)) {
          failures.push(`${shape.type} ${shape.id} bad bounds`)
        }
        renderToStaticMarkup(util.component(shape as never) as ReactElement)
      } catch (error) {
        failures.push(`${shape.type} ${shape.id}: ${(error as Error).message}`)
      }
    }
    expect(failures).toEqual([])
  })

  it('reports every filled geo as grabbable inside', () => {
    const util = utils.get('geo')
    const wrong: string[] = []
    let filled = 0
    let hollow = 0
    for (const shape of shapes.filter(s => s.type === 'geo')) {
      const props = shape.props as unknown as { fill: string; w: number; h: number; growY: number }
      const geometry = util!.getGeometry(shape as never)
      const body = geometry instanceof Group2d ? geometry.children[0] : geometry
      const shouldFill = props.fill !== 'none'
      if (shouldFill) filled++
      else hollow++
      if (body.isFilled !== shouldFill) wrong.push(`${shape.id} fill=${props.fill} isFilled=${body.isFilled}`)
      if (shouldFill) {
        const centre = new Vec(props.w / 2, (props.h + (props.growY ?? 0)) / 2)
        if (body.distanceToPoint(centre, false) >= 0) wrong.push(`${shape.id} centre not inside`)
      }
    }
    console.log(`geo on board: ${filled} filled, ${hollow} hollow`)
    expect(wrong).toEqual([])
  })

  it('gives every named frame a heading and a clip', () => {
    const util = utils.get('frame')
    const frames = shapes.filter(s => s.type === 'frame')
    const names = frames.map(f => (f.props as unknown as { name: string }).name).filter(Boolean)
    console.log(`frames: ${frames.length}, named: ${names.length} -> ${names.join(' | ')}`)
    for (const frame of frames) {
      expect(util!.getClipPath?.(frame as never)).toBeDefined()
      const painted = renderToStaticMarkup(util!.component(frame as never) as ReactElement)
      const name = (frame.props as unknown as { name: string }).name
      if (!name) continue
      expect(painted).toContain('var(--crew-scale, 1)')
    }
  })
})
