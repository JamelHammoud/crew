import { describe, it } from 'vitest'
import { Rectangle2d } from './src/renderer/src/canvas/geometry'
import { Vec } from './src/renderer/src/canvas/math'
describe('dbg', () => {
  it('degenerate segment', () => {
    const rect = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true })
    const a = { x: 50, y: 30 }
    console.log('isFilled', rect.isFilled, 'isClosed', rect.isClosed)
    console.log('Vec.Equals(a,a)', Vec.Equals(a as any, a as any))
    console.log('distanceToPoint', rect.distanceToPoint(a))
    console.log('distanceToLineSegment', rect.distanceToLineSegment(a, a))
    console.log('hitTestLineSegment', rect.hitTestLineSegment(a, a))
    console.log('vertices', rect.vertices.map(v => [v.x, v.y]))
  })
})
