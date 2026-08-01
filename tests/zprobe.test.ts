import { describe, it } from 'vitest'
import { numberToFloat16Bits, float16BitsToNumber, encodePoints, decodePoints, DIM_2D } from '../src/renderer/src/canvas/schema'

describe('z', () => {
  it('p', () => {
    console.log('tiny negative delta ->', numberToFloat16Bits(-1e-7).toString(16))
    console.log('plus zero ->', numberToFloat16Bits(0).toString(16))
    console.log('minus zero ->', numberToFloat16Bits(-0).toString(16))
    console.log('0x8000 decodes to ->', Object.is(float16BitsToNumber(0x8000), -0) ? '-0' : String(float16BitsToNumber(0x8000)))
    const pts = [{ x: 10, y: 10, z: 0.5 }, { x: 10 - 1e-7, y: 10, z: 0.5 }]
    const first = encodePoints(pts, DIM_2D)
    const again = encodePoints(decodePoints(first, DIM_2D), DIM_2D)
    console.log('first  :', first)
    console.log('again  :', again)
    console.log('points equal:', JSON.stringify(decodePoints(first, DIM_2D)) === JSON.stringify(decodePoints(again, DIM_2D)))
  })
})
