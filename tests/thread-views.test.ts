import { describe, expect, it } from 'vitest'
import {
  closeOne,
  focusAfterClose,
  isFull,
  openBeside,
  threadIdInHash,
  threadWindowHash,
  VIEW_LIMIT
} from '../src/shared/threadViews'

const row = (count: number): string[] => Array.from({ length: count }, (_, i) => `t${i + 1}`)

describe('a row of threads', () => {
  it('opens one beside the ones already open', () => {
    expect(openBeside([], 't1')).toEqual(['t1'])
    expect(openBeside(['t1'], 't2')).toEqual(['t1', 't2'])
  })

  it('leaves a thread where it stands rather than moving it to the end', () => {
    expect(openBeside(['t1', 't2', 't3'], 't1')).toEqual(['t1', 't2', 't3'])
  })

  it('holds at ten', () => {
    const full = row(VIEW_LIMIT)
    expect(isFull(full)).toBe(true)
    expect(openBeside(full, 'one-more')).toEqual(full)
    expect(isFull(row(VIEW_LIMIT - 1))).toBe(false)
  })

  it('closes the one named and leaves the rest in the order they were opened', () => {
    expect(closeOne(['t1', 't2', 't3'], 't2')).toEqual(['t1', 't3'])
    expect(closeOne(['t1'], 't1')).toEqual([])
  })
})

describe('where the caret goes when a column closes', () => {
  it('stays put when the column that closed was not the one being written in', () => {
    expect(focusAfterClose(['t1', 't2', 't3'], 't3', 't1')).toBe('t1')
  })

  it('takes the one that moved into its place', () => {
    expect(focusAfterClose(['t1', 't2', 't3'], 't2', 't2')).toBe('t3')
  })

  it('steps back when the last column goes', () => {
    expect(focusAfterClose(['t1', 't2'], 't2', 't2')).toBe('t1')
  })

  it('is nobody once the row is empty', () => {
    expect(focusAfterClose(['t1'], 't1', 't1')).toBeNull()
  })
})

describe('a thread in a window of its own', () => {
  it('writes the thread into the hash and reads it back', () => {
    expect(threadIdInHash(threadWindowHash('thread-1'))).toBe('thread-1')
    expect(threadIdInHash(threadWindowHash('a b/c#d'))).toBe('a b/c#d')
  })

  it('is nobody else, so the windows beside the app are never read as one', () => {
    expect(threadIdInHash('#tray')).toBeNull()
    expect(threadIdInHash('#scribe')).toBeNull()
    expect(threadIdInHash('')).toBeNull()
    expect(threadIdInHash('#thread=')).toBeNull()
    expect(threadIdInHash('#thread=%20')).toBeNull()
  })
})
