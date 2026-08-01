import { base62CharSet, generateNJitteredKeysBetween } from 'fractional-indexing-jittered'
import { describe, expect, it } from 'vitest'
import {
  ZERO_INDEX_KEY,
  getIndexAbove,
  getIndexBelow,
  getIndexBetween,
  getIndices,
  getIndicesAbove,
  getIndicesBetween,
  isIndexKey,
  sortByIndex,
  validateIndexKey,
  type IndexKey
} from '../src/renderer/src/canvas/schema'

const CHAR_SET = base62CharSet()

function jittered(below: string | null, above: string | null, count: number): string[] {
  return generateNJitteredKeysBetween(below, above, count, CHAR_SET)
}

describe('the keys the app really orders shapes with', () => {
  it('takes every key its own jittered generator hands out', () => {
    let below: string | null = ZERO_INDEX_KEY
    const rejected: string[] = []
    let generated = 0
    for (let round = 0; round < 2000; round++) {
      const keys = jittered(below, null, 3)
      for (const key of keys) {
        generated++
        if (!isIndexKey(key)) rejected.push(key)
      }
      below = keys[keys.length - 1]
    }
    expect(generated).toBeGreaterThan(5000)
    expect(rejected).toEqual([])
  })

  it('takes a key that ends in the smallest character', () => {
    expect(() => validateIndexKey('aA440')).not.toThrow()
    expect(isIndexKey('a10')).toBe(true)
    expect(isIndexKey('aY0T0')).toBe(true)
  })

  it('takes every key generated between two others', () => {
    let below: string | null = null
    let above: string | null = null
    for (let round = 0; round < 500; round++) {
      const pair = jittered(below, above, 2)
      for (const key of pair) expect(isIndexKey(key)).toBe(true)
      below = pair[0]
      above = pair[1]
    }
  })

  it('takes every key generated below a run of others', () => {
    let above: string | null = ZERO_INDEX_KEY
    for (let round = 0; round < 500; round++) {
      const keys = jittered(null, above, 3)
      for (const key of keys) expect(isIndexKey(key)).toBe(true)
      above = keys[0]
    }
  })

  it('still refuses something that is not a key at all', () => {
    expect(isIndexKey('')).toBe(false)
    expect(isIndexKey('!')).toBe(false)
    expect(isIndexKey('b')).toBe(false)
    expect(isIndexKey('c1')).toBe(false)
    expect(isIndexKey(CHAR_SET.mostNegative + '0'.repeat(26))).toBe(false)
  })

  it('takes the keys of its own helpers', () => {
    const above = getIndexAbove(ZERO_INDEX_KEY)
    const below = getIndexBelow(ZERO_INDEX_KEY)
    const between = getIndexBetween(below, above)
    for (const key of [above, below, between]) expect(isIndexKey(key)).toBe(true)
    for (const key of getIndices(20)) expect(isIndexKey(key)).toBe(true)
    for (const key of getIndicesAbove(ZERO_INDEX_KEY, 20)) expect(isIndexKey(key)).toBe(true)
    for (const key of getIndicesBetween(below, above, 20)) expect(isIndexKey(key)).toBe(true)
  })
})

describe('the order those keys put shapes in', () => {
  it('keeps a key made between two others between them', () => {
    const below = ZERO_INDEX_KEY
    const above = getIndexAbove(below)
    const middle = getIndexBetween(below, above)
    expect(below < middle).toBe(true)
    expect(middle < above).toBe(true)
  })

  it('runs a batch in the order it was asked for', () => {
    const keys = getIndicesBetween(ZERO_INDEX_KEY, getIndexAbove(getIndexAbove(ZERO_INDEX_KEY)), 30)
    const sorted = [...keys].sort()
    expect(keys).toEqual(sorted)
  })

  it('sorts records by what they carry', () => {
    const rows = [{ index: 'a3' as IndexKey }, { index: 'a1' as IndexKey }, { index: 'a2' as IndexKey }]
    expect([...rows].sort(sortByIndex).map(row => row.index)).toEqual(['a1', 'a2', 'a3'])
    expect(sortByIndex({ index: 'a1' as IndexKey }, { index: 'a1' as IndexKey })).toBe(0)
  })

  it('keeps a long run of appends in order and legible the whole way', () => {
    const keys: string[] = []
    let below: string | null = null
    for (let round = 0; round < 300; round++) {
      const next: string = jittered(below, null, 1)[0]
      expect(isIndexKey(next)).toBe(true)
      if (below) expect(below < next).toBe(true)
      keys.push(next)
      below = next
    }
    expect([...keys].sort()).toEqual(keys)
  })
})
