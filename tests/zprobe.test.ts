import { describe, it } from 'vitest'
import { numberToFloat16Bits, encodePoints, decodePoints, DIM_2D } from '../src/renderer/src/canvas/schema'

describe('z', () => {
  it('p', () => {
    console.log('-1e-9 ->', numberToFloat16Bits(-1e-9).toString(16))
    const pts = [{ x: 0, y: 0, z: 0.5 }, { x: -1e-9, y: 0, z: 0.5 }]
    const first = encodePoints(pts, DIM_2D)
    const decoded = decodePoints(first, DIM_2D)
    const again = encodePoints(decoded, DIM_2D)
    console.log('first :', first)
    console.log('again :', again)
    console.log('decoded x1 is -0 :', Object.is(decoded[1].x, -0))
    console.log('same points back :', JSON.stringify(decodePoints(again, DIM_2D)) === JSON.stringify(decoded))
  })
})
