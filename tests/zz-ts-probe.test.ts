// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

describe('timeStamp', () => {
  it('follows fake timers', () => {
    vi.useFakeTimers()
    const a = new Event('pointerdown')
    vi.advanceTimersByTime(1000)
    const b = new Event('pointerdown')
    console.log('a', a.timeStamp, 'b', b.timeStamp)
    const c = new MouseEvent('pointerdown', { timeStamp: 5000 } as never)
    console.log('c', c.timeStamp)
    vi.useRealTimers()
    expect(b.timeStamp - a.timeStamp).toBeGreaterThan(500)
  })
})
