import { describe, expect, it } from 'vitest'
import { firstBoard } from '../src/renderer/src/design/firstBoard'

describe('the first board', () => {
  it('makes one when the crew has none', () => {
    expect(firstBoard('online', 0, false)).toBe('make')
  })

  it('leaves a crew that already has one alone', () => {
    expect(firstBoard('online', 3, false)).toBe('have')
  })

  it('waits until the boards have arrived', () => {
    expect(firstBoard('connecting', 0, false)).toBe('wait')
    expect(firstBoard('reconnecting', 0, false)).toBe('wait')
    expect(firstBoard('booting', 0, false)).toBe('wait')
  })

  it('only asks once', () => {
    expect(firstBoard('online', 0, true)).toBe('wait')
  })

  it('forgets it asked once a board is there', () => {
    expect(firstBoard('online', 1, true)).toBe('have')
  })
})
