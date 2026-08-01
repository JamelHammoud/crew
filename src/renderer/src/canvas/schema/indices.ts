import { base62CharSet, generateNJitteredKeysBetween, generateNKeysBetween } from 'fractional-indexing-jittered'

export type IndexKey = string & { __brand: 'indexKey' }

export const ZERO_INDEX_KEY = 'a0' as IndexKey

const CHAR_SET = base62CharSet()
const ZERO = CHAR_SET.chars[0]
const SMALLEST_INTEGER = CHAR_SET.mostNegative + ZERO.repeat(26)

const keysBetween =
  process.env.NODE_ENV === 'test'
    ? (below: string | null, above: string | null, count: number) => generateNKeysBetween(below, above, count, CHAR_SET)
    : (below: string | null, above: string | null, count: number) =>
        generateNJitteredKeysBetween(below, above, count, CHAR_SET)

function distanceBetween(a: string, b: string): number {
  return Math.abs(CHAR_SET.byChar[a] - CHAR_SET.byChar[b])
}

function lengthFromSecondLevel(key: string, positive: boolean): number {
  const head = key[0]
  if (head === undefined || head > CHAR_SET.mostPositive || head < CHAR_SET.mostNegative) {
    throw new Error('invalid index: ' + key)
  }
  if (head === CHAR_SET.mostPositive && positive) {
    return distanceBetween(head, CHAR_SET.mostNegative) + 1 + lengthFromSecondLevel(key.slice(1), positive)
  }
  if (head === CHAR_SET.mostNegative && !positive) {
    return distanceBetween(head, CHAR_SET.mostPositive) + 1 + lengthFromSecondLevel(key.slice(1), positive)
  }
  return distanceBetween(head, positive ? CHAR_SET.mostNegative : CHAR_SET.mostPositive) + 2
}

function integerLength(key: string): number {
  const head = key[0]
  if (head === undefined || head > CHAR_SET.mostPositive || head < CHAR_SET.mostNegative) {
    throw new Error('invalid index: ' + key)
  }
  if (head === CHAR_SET.mostPositive) {
    return distanceBetween(head, CHAR_SET.firstPositive) + 1 + lengthFromSecondLevel(key.slice(1), true)
  }
  if (head === CHAR_SET.mostNegative) {
    return distanceBetween(head, CHAR_SET.firstNegative) + 1 + lengthFromSecondLevel(key.slice(1), false)
  }
  if (head >= CHAR_SET.firstPositive) return distanceBetween(head, CHAR_SET.firstPositive) + 2
  return distanceBetween(head, CHAR_SET.firstNegative) + 2
}

export function validateIndexKey(index: string): asserts index is IndexKey {
  if (index === SMALLEST_INTEGER) throw new Error('invalid index: ' + index)
  if (integerLength(index) > index.length) throw new Error('invalid index: ' + index)
}

export function isIndexKey(index: string): index is IndexKey {
  try {
    validateIndexKey(index)
    return true
  } catch {
    return false
  }
}

export function getIndicesBetween(
  below: IndexKey | null | undefined,
  above: IndexKey | null | undefined,
  count: number
): IndexKey[] {
  return keysBetween(below ?? null, above ?? null, count) as IndexKey[]
}

export function getIndicesAbove(below: IndexKey | null | undefined, count: number): IndexKey[] {
  return keysBetween(below ?? null, null, count) as IndexKey[]
}

export function getIndicesBelow(above: IndexKey | null | undefined, count: number): IndexKey[] {
  return keysBetween(null, above ?? null, count) as IndexKey[]
}

export function getIndexBetween(below: IndexKey | null | undefined, above: IndexKey | null | undefined): IndexKey {
  return keysBetween(below ?? null, above ?? null, 1)[0] as IndexKey
}

export function getIndexAbove(below: IndexKey | null | undefined = null): IndexKey {
  return keysBetween(below ?? null, null, 1)[0] as IndexKey
}

export function getIndexBelow(above: IndexKey | null | undefined = null): IndexKey {
  return keysBetween(null, above ?? null, 1)[0] as IndexKey
}

export function getIndices(count: number, start = 'a1' as IndexKey): IndexKey[] {
  return [start, ...keysBetween(start, null, count)] as IndexKey[]
}

export function sortByIndex<Item extends { index: IndexKey }>(a: Item, b: Item): number {
  if (a.index < b.index) return -1
  if (a.index > b.index) return 1
  return 0
}
