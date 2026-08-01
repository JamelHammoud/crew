// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  atom,
  computed,
  getGlobalEpoch,
  isAtom,
  isSignal,
  react,
  reactor,
  RESET_VALUE,
  track,
  transact,
  transaction,
  unsafe__withoutCapture,
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

function swallow(fn: () => void): void {
  try {
    fn()
  } catch {
    return
  }
}

describe('the shape of the graph', () => {
  it('runs a leaf exactly once for a diamond', () => {
    const source = atom('source', 1)
    const left = computed('left', () => source.get() + 1)
    const right = computed('right', () => source.get() * 2)
    const leaf = vi.fn(() => {
      left.get()
      right.get()
    })
    react('leaf', leaf)
    expect(leaf).toHaveBeenCalledTimes(1)
    source.set(2)
    expect(leaf).toHaveBeenCalledTimes(2)
    source.set(3)
    expect(leaf).toHaveBeenCalledTimes(3)
  })

  it('runs a leaf exactly once for a diamond two layers deep', () => {
    const source = atom('source', 1)
    const first = computed('first', () => source.get() + 1)
    const second = computed('second', () => source.get() + 2)
    const sum = computed('sum', () => first.get() + second.get())
    const difference = computed('difference', () => first.get() - second.get())
    const leaf = vi.fn(() => {
      sum.get()
      difference.get()
    })
    react('leaf', leaf)
    source.set(9)
    expect(leaf).toHaveBeenCalledTimes(2)
  })

  it('keeps the same parent arrays when it reads the same parents in the same order', () => {
    const a = atom('a', 1)
    const b = atom('b', 2)
    const sum = computed('sum', () => a.get() + b.get()) as unknown as {
      parents: unknown[]
      parentEpochs: number[]
    }
    react('r', () => (sum as unknown as { get(): number }).get())
    const parents = sum.parents
    const epochs = sum.parentEpochs
    a.set(5)
    expect(sum.parents).toBe(parents)
    expect(sum.parentEpochs).toBe(epochs)
    expect(sum.parents.length).toBe(2)
  })

  it('shrinks the parent arrays when it reads fewer parents', () => {
    const both = atom('both', true)
    const a = atom('a', 1)
    const b = atom('b', 2)
    const value = computed('value', () => (both.get() ? a.get() + b.get() : a.get())) as unknown as {
      get(): number
      parents: unknown[]
      parentEpochs: number[]
    }
    react('r', () => value.get())
    expect(value.parents.length).toBe(3)
    both.set(false)
    expect(value.parents.length).toBe(2)
    expect(value.parentEpochs.length).toBe(2)
  })

  it('stops propagating when a recompute lands on an equal value', () => {
    const source = atom('source', 1.2)
    const floored = computed('floored', () => Math.floor(source.get()))
    const scale = vi.fn(() => floored.get() * 10)
    const scaled = computed('scaled', scale)
    expect(scaled.get()).toBe(10)
    expect(scale).toHaveBeenCalledTimes(1)
    source.set(1.5)
    expect(scaled.get()).toBe(10)
    expect(scale).toHaveBeenCalledTimes(1)
    source.set(2.5)
    expect(scaled.get()).toBe(20)
    expect(scale).toHaveBeenCalledTimes(2)
  })

  it('never asks isEqual about the first computation', () => {
    const isEqual = vi.fn((a, b) => a === b)
    const source = atom('source', 1)
    const doubled = computed('doubled', () => source.get() * 2, { isEqual })
    expect(doubled.get()).toBe(2)
    expect(isEqual).not.toHaveBeenCalled()
    source.set(2)
    expect(doubled.get()).toBe(4)
    expect(isEqual).toHaveBeenCalledTimes(1)
  })

  it('never recomputes when the first run read nothing', () => {
    const derive = vi.fn(() => 1)
    const constant = computed('constant', derive) as unknown as { get(): number; parents: unknown[] }
    expect(constant.get()).toBe(1)
    const unrelated = atom('unrelated', 0)
    unrelated.set(1)
    unrelated.set(2)
    expect(constant.get()).toBe(1)
    expect(derive).toHaveBeenCalledTimes(1)
    expect(constant.parents.length).toBe(0)
  })

  it('reads nothing at all inside withoutCapture', () => {
    const source = atom('source', 1)
    const value = computed('value', () => unsafe__withoutCapture(() => source.get())) as unknown as {
      get(): number
      parents: unknown[]
    }
    react('r', () => value.get())
    expect(value.parents.length).toBe(0)
  })

  it('puts the capture context back when what it wrapped threw', () => {
    const a = atom('a', 1)
    const b = atom('b', 2)
    const value = computed('value', () => {
      a.get()
      swallow(() =>
        unsafe__withoutCapture(() => {
          throw new Error('boom')
        })
      )
      return a.get() + b.get()
    }) as unknown as { get(): number; parents: unknown[] }
    react('r', () => value.get())
    expect(value.parents.length).toBe(2)
  })
})

describe('a computed that throws', () => {
  it('holds on to what it threw until a parent changes', () => {
    const source = atom('source', 1)
    const derive = vi.fn(() => {
      if (source.get() === 2) throw new Error('boom')
      return source.get()
    })
    const value = computed('value', derive)
    expect(value.get()).toBe(1)
    expect(derive).toHaveBeenCalledTimes(1)
    source.set(2)
    expect(() => value.get()).toThrow('boom')
    expect(() => value.get()).toThrow('boom')
    expect(() => value.get()).toThrow('boom')
    expect(derive).toHaveBeenCalledTimes(2)
    source.set(3)
    expect(value.get()).toBe(3)
  })

  it('tells an effect it went wrong once rather than every time', () => {
    const source = atom('source', 1)
    const derive = vi.fn(() => {
      if (source.get() % 2 === 0) throw new Error('boom')
      return source.get()
    })
    const value = computed('value', derive)
    const effect = vi.fn(() => swallow(() => value.get()))
    react('r', effect)
    expect(effect).toHaveBeenCalledTimes(1)
    source.set(2)
    expect(effect).toHaveBeenCalledTimes(2)
    source.set(4)
    expect(derive).toHaveBeenCalledTimes(3)
    expect(effect).toHaveBeenCalledTimes(2)
    source.set(3)
    expect(effect).toHaveBeenCalledTimes(3)
  })

  it('throws its history away', () => {
    const source = atom('source', 1)
    const value = computed(
      'value',
      () => {
        if (source.get() === 2) throw new Error('boom')
        return source.get()
      },
      { historyLength: 4, computeDiff: (from: number, to: number) => to - from }
    )
    const start = getGlobalEpoch()
    expect(value.get()).toBe(1)
    source.set(3)
    expect(value.get()).toBe(3)
    source.set(2)
    expect(() => value.get()).toThrow()
    source.set(5)
    expect(value.get()).toBe(5)
    expect(value.getDiffSince(start)).toBe(RESET_VALUE)
  })

  it('does not carry the throw out through a parent check', () => {
    const source = atom('source', 1)
    const thrower = computed('thrower', () => {
      if (source.get() === 2) throw new Error('boom')
      return source.get()
    })
    const guarded = computed('guarded', () => {
      try {
        return thrower.get()
      } catch {
        return -1
      }
    })
    let seen = 0
    react('r', () => {
      seen = guarded.get()
    })
    expect(seen).toBe(1)
    expect(() => source.set(2)).not.toThrow()
    expect(seen).toBe(-1)
  })

  it('leaves the atom that caused it where it is', () => {
    const source = atom('source', 1)
    const value = computed('value', () => {
      if (source.get() === 2) throw new Error('boom')
      return source.get()
    })
    expect(value.get()).toBe(1)
    source.set(2)
    expect(() => value.get()).toThrow()
    expect(source.get()).toBe(2)
  })
})

describe('what a transaction puts back', () => {
  it('puts every atom back the way it found it', () => {
    const a = atom('a', 1)
    const b = atom('b', 2)
    transaction(rollback => {
      a.set(10)
      b.set(20)
      rollback()
    })
    expect(a.get()).toBe(1)
    expect(b.get()).toBe(2)
  })

  it('puts a computed back with them', () => {
    const source = atom('source', 1)
    const doubled = computed('doubled', () => source.get() * 2)
    expect(doubled.get()).toBe(2)
    transaction(rollback => {
      source.set(10)
      expect(doubled.get()).toBe(20)
      rollback()
    })
    expect(doubled.get()).toBe(2)
  })

  it('moves the epoch on when it gives up', () => {
    const source = atom('source', 1)
    const before = getGlobalEpoch()
    transaction(rollback => {
      source.set(2)
      rollback()
    })
    expect(getGlobalEpoch()).toBeGreaterThan(before)
  })

  it('lets an inner one give up on its own', () => {
    const a = atom('a', 1)
    const b = atom('b', 1)
    transaction(() => {
      a.set(2)
      transaction(rollback => {
        b.set(2)
        rollback()
      })
    })
    expect(a.get()).toBe(2)
    expect(b.get()).toBe(1)
  })

  it('takes a finished inner one down with the outer one', () => {
    const source = atom('source', 1)
    transaction(rollback => {
      transaction(() => {
        source.set(2)
      })
      rollback()
    })
    expect(source.get()).toBe(1)
  })

  it('gives up and says why when the work throws', () => {
    const source = atom('source', 1)
    expect(() =>
      transaction(() => {
        source.set(2)
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(source.get()).toBe(1)
  })

  it('joins the one already going rather than standing inside it', () => {
    const source = atom('source', 1)
    transaction(() => {
      source.set(2)
      swallow(() =>
        transact(() => {
          source.set(3)
          throw new Error('boom')
        })
      )
    })
    expect(source.get()).toBe(3)
  })

  it('holds every effect until it commits', () => {
    const source = atom('source', 1)
    const effect = vi.fn(() => source.get())
    react('r', effect)
    expect(effect).toHaveBeenCalledTimes(1)
    transact(() => {
      source.set(2)
      source.set(3)
      source.set(4)
      expect(effect).toHaveBeenCalledTimes(1)
    })
    expect(effect).toHaveBeenCalledTimes(2)
  })
})

describe('the flush loop', () => {
  it('drains what an effect set while it was reacting', () => {
    const a = atom('a', 0)
    const b = atom('b', 0)
    react('r', () => {
      b.set(a.get() + 1)
    })
    expect(b.get()).toBe(1)
    a.set(4)
    expect(b.get()).toBe(5)
  })

  it('stands down rather than spinning forever', () => {
    expect(() => {
      const source = atom('source', 0)
      react('r', () => {
        source.set(source.get() + 1)
      })
    }).toThrow()
  })

  it('leaves a reactor alone when nothing it reads has moved', () => {
    const source = atom('source', 1)
    const fn = vi.fn(() => source.get())
    const started = reactor('r', fn)
    started.start()
    expect(fn).toHaveBeenCalledTimes(1)
    started.stop()
    started.start()
    expect(fn).toHaveBeenCalledTimes(1)
    started.start({ force: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
