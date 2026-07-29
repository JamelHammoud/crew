import { describe, expect, it } from 'vitest'
import { WAVE_MS, waveBands } from '../src/renderer/src/media/bands'

const COUNT = 12

const row = (at: number): number[] => waveBands(at, COUNT, new Array<number>(COUNT).fill(0))

const crestOf = (bands: number[]): number => bands.indexOf(Math.max(...bands))

describe('the row while a reading finishes', () => {
  it('stays inside what a band can be', () => {
    for (let at = 0; at < WAVE_MS * 2; at += 37) {
      for (const band of row(at)) {
        expect(band).toBeGreaterThanOrEqual(0)
        expect(band).toBeLessThanOrEqual(1)
      }
    }
  })

  it('always has a crest in it, so the row is never a flat line', () => {
    for (let at = 0; at < WAVE_MS * 2; at += 13) {
      expect(Math.max(...row(at))).toBeGreaterThan(0.9)
    }
  })

  it('travels low to high', () => {
    const seen: number[] = []
    for (let step = 0; step < COUNT; step++) seen.push(crestOf(row((step * WAVE_MS) / COUNT)))
    // Once round the row, one band at a time, and back where it started.
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('comes round again rather than running off the end', () => {
    const later = row(WAVE_MS * 3 + 210)
    row(210).forEach((band, at) => expect(later[at]).toBeCloseTo(band, 6))
  })

  it('is a crest rather than half the row rising together', () => {
    const lit = row(0).filter(band => band > 0.5).length
    expect(lit).toBeLessThan(COUNT / 2)
    expect(lit).toBeGreaterThan(0)
  })

  it('writes into the row it is handed rather than making one a frame', () => {
    const out = new Array<number>(COUNT).fill(0)
    expect(waveBands(120, COUNT, out)).toBe(out)
  })
})
