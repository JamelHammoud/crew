// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  atom,
  computed,
  isAtom,
  isSignal,
  react,
  track,
  transact,
  transaction,
  useAtom,
  useComputed,
  useQuickReactor,
  useValue
} from '../src/renderer/src/canvas/signals'

afterEach(cleanup)

describe('atoms', () => {
  it('reads, writes and updates', () => {
    const count = atom('count', 1)
    expect(count.get()).toBe(1)
    count.set(2)
    expect(count.get()).toBe(2)
    count.update(n => n + 1)
    expect(count.get()).toBe(3)
  })

  it('bumps the epoch only when the value really changed', () => {
    const count = atom('count', 1)
    const first = count.lastChangedEpoch
    count.set(1)
    expect(count.lastChangedEpoch).toBe(first)
    count.set(2)
    expect(count.lastChangedEpoch).toBeGreaterThan(first)
  })

  it('honours the isEqual option', () => {
    const point = atom('point', { x: 0 }, { isEqual: (a, b) => a.x === b.x })
    const first = point.lastChangedEpoch
    point.set({ x: 0 })
    expect(point.lastChangedEpoch).toBe(first)
    point.set({ x: 1 })
    expect(point.lastChangedEpoch).toBeGreaterThan(first)
  })

  it('keeps a history buffer for getDiffSince', () => {
    const count = atom('count', 0, { historyLength: 4, computeDiff: (a, b) => b - a })
    const start = count.lastChangedEpoch
    count.set(1)
    count.set(3)
    expect(count.getDiffSince(start)).toEqual([1, 2])
  })

  it('says what it is', () => {
    const count = atom('count', 0)
    const doubled = computed('doubled', () => count.get() * 2)
    expect(isAtom(count)).toBe(true)
    expect(isAtom(doubled)).toBe(false)
    expect(isSignal(count)).toBe(true)
    expect(isSignal(doubled)).toBe(true)
    expect(isSignal({ get: () => 1 })).toBe(false)
  })
})

describe('computed', () => {
  it('is lazy and caches', () => {
    const count = atom('count', 1)
    let derives = 0
    const doubled = computed('doubled', () => {
      derives++
      return count.get() * 2
    })
    expect(derives).toBe(0)
    expect(doubled.get()).toBe(2)
    expect(doubled.get()).toBe(2)
    expect(derives).toBe(1)
    count.set(2)
    expect(doubled.get()).toBe(4)
    expect(derives).toBe(2)
  })

  it('caches a thrown error and rethrows it without recomputing', () => {
    const count = atom('count', 1)
    let derives = 0
    const risky = computed('risky', () => {
      derives++
      const n = count.get()
      if (n > 1) throw new Error('boom')
      return n
    })

    expect(risky.get()).toBe(1)
    expect(derives).toBe(1)

    count.set(2)

    let first: unknown
    try {
      risky.get()
    } catch (e) {
      first = e
    }
    expect((first as Error).message).toBe('boom')
    expect(derives).toBe(2)

    let second: unknown
    try {
      risky.get()
    } catch (e) {
      second = e
    }
    expect(second).toBe(first)
    expect(derives).toBe(2)

    count.set(1)
    expect(risky.get()).toBe(1)
    expect(derives).toBe(3)
  })

  it('drops a parent it no longer reads', () => {
    const which = atom('which', true)
    const left = atom('left', 'L')
    const right = atom('right', 'R')
    const picked = computed('picked', () => (which.get() ? left.get() : right.get()))

    let runs = 0
    const stop = react('watch', () => {
      picked.get()
      runs++
    })
    expect(runs).toBe(1)

    right.set('R2')
    expect(runs).toBe(1)

    which.set(false)
    expect(runs).toBe(2)

    left.set('L2')
    expect(runs).toBe(2)

    right.set('R3')
    expect(runs).toBe(3)
    stop()
  })
})

describe('the graph', () => {
  it('fires the leaf of a diamond exactly once per change', () => {
    const source = atom('source', 1)
    let leftRuns = 0
    let rightRuns = 0
    let joinRuns = 0

    const left = computed('left', () => {
      leftRuns++
      return source.get() + 1
    })
    const right = computed('right', () => {
      rightRuns++
      return source.get() * 2
    })
    const join = computed('join', () => {
      joinRuns++
      return left.get() + right.get()
    })

    const seen: number[] = []
    const stop = react('leaf', () => seen.push(join.get()))

    expect(seen).toEqual([4])
    expect(joinRuns).toBe(1)

    source.set(2)
    expect(seen).toEqual([4, 7])
    expect(leftRuns).toBe(2)
    expect(rightRuns).toBe(2)
    expect(joinRuns).toBe(2)

    source.set(3)
    expect(seen).toEqual([4, 7, 10])
    expect(joinRuns).toBe(3)
    stop()
  })

  it('does not propagate a recompute that lands on an equal value', () => {
    const count = atom('count', 1)
    let derives = 0
    let runs = 0

    const isEven = computed('isEven', () => {
      derives++
      return count.get() % 2 === 0
    })

    const stop = react('watch', () => {
      isEven.get()
      runs++
    })

    expect(runs).toBe(1)
    expect(derives).toBe(1)

    count.set(3)
    expect(derives).toBe(2)
    expect(runs).toBe(1)

    count.set(5)
    expect(derives).toBe(3)
    expect(runs).toBe(1)

    count.set(2)
    expect(derives).toBe(4)
    expect(runs).toBe(2)
    stop()
  })
})

describe('transactions', () => {
  it('rolls every atom back when the body throws', () => {
    const a = atom('a', 1)
    const b = atom('b', 2)
    const c = atom('c', 3)

    expect(() =>
      transaction(() => {
        a.set(10)
        b.set(20)
        c.set(30)
        throw new Error('nope')
      })
    ).toThrow('nope')

    expect(a.get()).toBe(1)
    expect(b.get()).toBe(2)
    expect(c.get()).toBe(3)
  })

  it('rolls back when asked to', () => {
    const a = atom('a', 1)
    transaction(rollback => {
      a.set(9)
      rollback()
    })
    expect(a.get()).toBe(1)
  })

  it('tells an effect about a batch of changes once', () => {
    const a = atom('a', 1)
    const b = atom('b', 1)
    const seen: number[] = []
    const stop = react('sum', () => seen.push(a.get() + b.get()))

    expect(seen).toEqual([2])

    transact(() => {
      a.set(2)
      b.set(3)
    })

    expect(seen).toEqual([2, 5])
    stop()
  })

  it('never shows an effect a value the body rolled back', () => {
    const a = atom('a', 1)
    const seen: number[] = []
    const stop = react('watch', () => seen.push(a.get()))
    expect(seen).toEqual([1])

    expect(() =>
      transact(() => {
        a.set(2)
        throw new Error('nope')
      })
    ).toThrow('nope')

    expect(a.get()).toBe(1)
    expect(seen.every(v => v === 1)).toBe(true)
    stop()
  })
})

describe('effects', () => {
  it('drains an effect that writes to an atom during a flush', () => {
    const source = atom('source', 0)
    const mirror = atom('mirror', 0)
    const seen: number[] = []

    const stopWriter = react('writer', () => mirror.set(source.get() * 2))
    const stopReader = react('reader', () => seen.push(mirror.get()))

    expect(seen).toEqual([0])

    source.set(3)

    expect(mirror.get()).toBe(6)
    expect(seen).toEqual([0, 6])

    stopWriter()
    stopReader()
  })

  it('settles an effect that writes to the atom it reads', () => {
    const n = atom('n', 0)
    let runs = 0
    const stop = react('clamp', () => {
      runs++
      if (n.get() > 10) n.set(10)
    })

    expect(runs).toBe(1)
    n.set(50)

    expect(n.get()).toBe(10)
    expect(runs).toBe(3)
    stop()
  })

  it('stops a runaway effect at the depth limit', () => {
    const n = atom('n', 0)
    const stop = react('runaway', () => {
      const v = n.get()
      if (v > 0) n.set(v + 1)
    })
    try {
      expect(() => n.set(1)).toThrow(/depth limit/)
    } finally {
      stop()
    }
  })

  it('stops listening when it is stopped', () => {
    const a = atom('a', 1)
    let runs = 0
    const stop = react('watch', () => {
      a.get()
      runs++
    })
    a.set(2)
    expect(runs).toBe(2)
    stop()
    a.set(3)
    expect(runs).toBe(2)
  })
})

describe('useValue', () => {
  it('computes once for a body that reads no signal at all, and does not throw', () => {
    const plain = { value: 3 }
    let derives = 0
    let renders = 0

    function Probe(): ReturnType<typeof createElement> {
      renders++
      const value = useValue('plain', () => {
        derives++
        return plain.value * 2
      }, [])
      return createElement('span', { 'data-testid': 'out' }, String(value))
    }

    render(createElement(Probe))

    expect(screen.getByTestId('out').textContent).toBe('6')
    expect(derives).toBe(1)
    expect(renders).toBeGreaterThan(0)
  })

  it('follows a signal it is handed', () => {
    const count = atom('count', 1)

    function Probe(): ReturnType<typeof createElement> {
      const value = useValue(count)
      return createElement('span', { 'data-testid': 'out' }, String(value))
    }

    render(createElement(Probe))
    expect(screen.getByTestId('out').textContent).toBe('1')

    act(() => {
      count.set(2)
    })
    expect(screen.getByTestId('out').textContent).toBe('2')
  })

  it('does not re-render when a recompute lands on an equal value', () => {
    const count = atom('count', 1)
    let renders = 0

    function Probe(): ReturnType<typeof createElement> {
      renders++
      const even = useValue('even', () => count.get() % 2 === 0, [])
      return createElement('span', { 'data-testid': 'out' }, String(even))
    }

    render(createElement(Probe))
    expect(screen.getByTestId('out').textContent).toBe('false')
    const settled = renders

    act(() => {
      count.set(3)
    })
    expect(renders).toBe(settled)

    act(() => {
      count.set(2)
    })
    expect(screen.getByTestId('out').textContent).toBe('true')
    expect(renders).toBeGreaterThan(settled)
  })
})

describe('the react bindings', () => {
  it('re-renders a tracked component when what it read changes', () => {
    const count = atom('count', 1)
    const Tracked = track(function Tracked() {
      return createElement('span', { 'data-testid': 'out' }, String(count.get()))
    })

    render(createElement(Tracked))
    expect(screen.getByTestId('out').textContent).toBe('1')

    act(() => {
      count.set(2)
    })
    expect(screen.getByTestId('out').textContent).toBe('2')
  })

  it('runs a quick reactor outside the render', () => {
    const count = atom('count', 1)
    const seen: number[] = []

    function Probe(): ReturnType<typeof createElement> {
      useQuickReactor('watch', () => {
        seen.push(count.get())
      })
      return createElement('span', { 'data-testid': 'out' }, 'ok')
    }

    const view = render(createElement(Probe))
    expect(seen).toEqual([1])

    act(() => {
      count.set(2)
    })
    expect(seen).toEqual([1, 2])

    view.unmount()
    act(() => {
      count.set(3)
    })
    expect(seen).toEqual([1, 2])
  })

  it('holds one atom and one computed for the life of a component', () => {
    let seenAtom: unknown = null

    function Probe(): ReturnType<typeof createElement> {
      const count = useAtom('count', 1)
      const doubled = useComputed('doubled', () => count.get() * 2, [count])
      seenAtom = count
      const value = useValue(doubled)
      return createElement('button', { 'data-testid': 'out', onClick: () => count.update(n => n + 1) }, String(value))
    }

    render(createElement(Probe))
    const button = screen.getByTestId('out')
    expect(button.textContent).toBe('2')
    const first = seenAtom

    act(() => {
      button.click()
    })
    expect(button.textContent).toBe('4')
    expect(seenAtom).toBe(first)
  })
})
