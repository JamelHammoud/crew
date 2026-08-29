import { describe, expect, it } from 'vitest'
import {
  closeOne,
  focusAfterClose,
  isFull,
  NEAR_RIGHT,
  nearRight,
  openBeside,
  stickyIdInHash,
  stickyWindowHash,
  threadIdInHash,
  threadMenuActions,
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

describe('what the right click on a thread offers', () => {
  it('opens the first one and stands the next beside it', () => {
    expect(threadMenuActions([], 't1')).toEqual(['open', 'window'])
    expect(threadMenuActions(['t1'], 't2')).toEqual(['beside', 'window'])
  })

  it('is a window of its own or the way out for one already in the row', () => {
    expect(threadMenuActions(['t1', 't2'], 't2')).toEqual(['window', 'close'])
  })

  it('leaves the row out once it is full rather than offering a move that cannot happen', () => {
    expect(threadMenuActions(row(VIEW_LIMIT), 'one-more')).toEqual(['window'])
  })

  it('cannot put a thread of another project in this row, so it offers to go there or to a window', () => {
    expect(threadMenuActions(['t1'], 'elsewhere', false)).toEqual(['open', 'window'])
    expect(threadMenuActions(row(VIEW_LIMIT), 'elsewhere', false)).toEqual(['open', 'window'])
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

describe('a sticky in a window of its own', () => {
  it('writes the sticky into the hash and reads it back', () => {
    expect(stickyIdInHash(stickyWindowHash('sticky-1'))).toBe('sticky-1')
    expect(stickyIdInHash(stickyWindowHash('a b/c#d'))).toBe('a b/c#d')
  })

  it('does not mistake the library or another window for a sticky', () => {
    expect(stickyIdInHash('#stickies')).toBeNull()
    expect(stickyIdInHash('#personal')).toBeNull()
    expect(stickyIdInHash('#sticky=')).toBeNull()
    expect(stickyIdInHash('#sticky=%20')).toBeNull()
  })
})

describe('the way to another column', () => {
  const RIGHT = 1200

  it('stands only for a pointer already at the edge it hangs off', () => {
    expect(nearRight(RIGHT, RIGHT)).toBe(true)
    expect(nearRight(RIGHT - NEAR_RIGHT, RIGHT)).toBe(true)
    expect(nearRight(RIGHT - NEAR_RIGHT - 1, RIGHT)).toBe(false)
    expect(nearRight(0, RIGHT)).toBe(false)
  })

  it('reads the edge it is handed rather than the window, so a panel beside it moves the reach', () => {
    expect(nearRight(700, 720)).toBe(true)
    expect(nearRight(700, RIGHT)).toBe(false)
  })
})
