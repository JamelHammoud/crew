import { describe, expect, it } from 'vitest'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { getVisibleGaps, snapTranslateBounds } from '../src/renderer/src/canvas/tools/snaps'

describe('gap cost', () => {
  it('measures', () => {
    const nodes = Array.from({ length: 218 }, (_, i) => ({
      id: `shape:n${i}`,
      pageBounds: new Box((i % 15) * 220, Math.floor(i / 15) * 180, 160, 120)
    }))
    let start = performance.now()
    for (let i = 0; i < 60; i++) getVisibleGaps(nodes)
    const gaps = performance.now() - start
    start = performance.now()
    for (let i = 0; i < 60; i++) {
      snapTranslateBounds({
        initialSelectionPageBounds: new Box(0, 0, 160, 120),
        dragDelta: { x: i, y: i },
        snappableShapes: nodes,
        zoom: 1
      })
    }
    const whole = performance.now() - start
    console.log(`getVisibleGaps x60: ${gaps.toFixed(1)}ms  (${(gaps / 60).toFixed(2)}ms per move)`)
    console.log(`snapTranslateBounds x60: ${whole.toFixed(1)}ms  (${(whole / 60).toFixed(2)}ms per move)`)
    console.log(`gaps are ${((gaps / whole) * 100).toFixed(0)}% of the whole`)
    expect(whole).toBeGreaterThan(0)
  })
})
