import { describe, expect, it } from 'vitest'
import { keepWholePixels } from '../src/renderer/src/design/wholePixels'

interface Shape {
  id: string
  type: string
  x: number
  y: number
  props: Record<string, unknown>
}

type Create = (shape: Shape, source: string) => Shape
type Change = (prev: Shape, next: Shape, source: string) => Shape

function canvas() {
  let create: Create = shape => shape
  let change: Change = (_prev, next) => next
  const editor = {
    sideEffects: {
      registerBeforeCreateHandler: (_type: string, handler: Create) => {
        create = handler
        return () => {}
      },
      registerBeforeChangeHandler: (_type: string, handler: Change) => {
        change = handler
        return () => {}
      }
    }
  }
  keepWholePixels(editor as never)
  return {
    draws: (shape: Shape) => create(shape, 'user'),
    drags: (prev: Shape, next: Shape) => change(prev, next, 'user'),
    syncs: (prev: Shape, next: Shape) => change(prev, next, 'remote')
  }
}

function node(x: number, y: number, w: number, h: number, props: Record<string, unknown> = {}): Shape {
  return { id: 'shape:card', type: 'design-node', x, y, props: { w, h, ...props } }
}

describe('whole pixels', () => {
  it('rounds the size when an edge is dragged to a fraction', () => {
    const board = canvas()
    const next = board.drags(node(100, 100, 200, 160), node(100, 100, 213.42, 160))
    expect(sizeIn(next)).toEqual({ w: 213, h: 160 })
  })

  it('leaves the far edge exactly where it was when the near edge is dragged', () => {
    const board = canvas()
    const next = board.drags(node(100, 100, 200, 160), node(87.5, 100, 212.5, 160))
    expect(next.x).toBe(88)
    expect(next.x + (sizeIn(next).w as number)).toBe(300)
  })

  it('rounds both axes when a corner is dragged', () => {
    const board = canvas()
    const next = board.drags(node(100, 100, 200, 160), node(93.7, 88.2, 206.3, 171.8))
    expect(next).toMatchObject({ x: 94, y: 88 })
    expect(sizeIn(next)).toEqual({ w: 206, h: 172 })
  })

  it('never rounds a shape away to nothing', () => {
    const board = canvas()
    const next = board.drags(node(0, 0, 200, 160), node(0, 0, 0.2, 0.4))
    expect(sizeIn(next)).toEqual({ w: 1, h: 1 })
  })

  it('rounds a shape as it is drawn', () => {
    const board = canvas()
    expect(board.draws(node(12.4, 40.9, 88.6, 30.3))).toMatchObject({
      x: 12,
      y: 41,
      props: { w: 89, h: 30 }
    })
  })

  it('leaves a shape alone when only its style changed', () => {
    const board = canvas()
    const before = node(10.5, 10.5, 200.5, 160.5, { fills: [] })
    const next = board.drags(before, { ...before, props: { ...before.props, fills: [{ color: '#fff' }] } })
    expect(next).toMatchObject({ x: 10.5, props: { w: 200.5, h: 160.5 } })
  })

  it('leaves work arriving from someone else alone', () => {
    const board = canvas()
    expect(board.syncs(node(0, 0, 200, 160), node(0, 0, 213.42, 160))).toMatchObject({
      props: { w: 213.42 }
    })
  })

  it('only moves shapes that carry no size, like a pencil stroke', () => {
    const board = canvas()
    const prev = { id: 'shape:ink', type: 'draw', x: 4, y: 4, props: { segments: [] } }
    const next = board.drags(prev, { ...prev, x: 4.6, y: 9.1 })
    expect(next).toMatchObject({ x: 5, y: 9, props: { segments: [] } })
  })
})

function sizeIn(shape: Shape): { w: unknown; h: unknown } {
  return { w: shape.props.w, h: shape.props.h }
}
