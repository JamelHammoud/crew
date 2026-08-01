import { describe, expect, it, vi } from 'vitest'
import {
  atom,
  computed,
  react,
  reactor,
  transact,
  transaction,
  unsafe__withoutCapture,
  getGlobalEpoch,
  RESET_VALUE
} from '../src/renderer/src/canvas/signals'

describe('probe: reactive core', () => {
  it('diamond fires the leaf exactly once', () => {
    const a = atom('a', 1)
    const left = computed('left', () => a.get() + 1)
    const right = computed('right', () => a.get() * 2)
    const effect = vi.fn(() => {
      left.get()
      right.get()
    })
    react('leaf', effect)
    expect(effect).toHaveBeenCalledTimes(1)
    a.set(2)
    expect(effect).toHaveBeenCalledTimes(2)
    a.set(3)
    expect(effect).toHaveBeenCalledTimes(3)
  })

  it('deep diamond fires once', () => {
    const a = atom('a', 1)
    const b = computed('b', () => a.get() + 1)
    const c = computed('c', () => a.get() + 2)
    const d = computed('d', () => b.get() + c.get())
    const e = computed('e', () => b.get() - c.get())
    const effect = vi.fn(() => {
      d.get()
      e.get()
    })
    react('leaf', effect)
    a.set(9)
    expect(effect).toHaveBeenCalledTimes(2)
  })

  it('reuses positional dependencies without reallocating', () => {
    const a = atom('a', 1)
    const b = atom('b', 2)
    const c = computed('c', () => a.get() + b.get()) as any
    react('r', () => c.get())
    const parents = c.parents
    const epochs = c.parentEpochs
    a.set(5)
    expect(c.parents).toBe(parents)
    expect(c.parentEpochs).toBe(epochs)
    expect(c.parents.length).toBe(2)
  })

  it('shrinks the parent arrays when fewer parents are captured', () => {
    const useBoth = atom('useBoth', true)
    const a = atom('a', 1)
    const b = atom('b', 2)
    const c = computed('c', () => (useBoth.get() ? a.get() + b.get() : a.get())) as any
    react('r', () => c.get())
    expect(c.parents.length).toBe(3)
    useBoth.set(false)
    expect(c.parents.length).toBe(2)
    expect(c.parentEpochs.length).toBe(2)
  })

  it('short circuits when a recompute produces an equal value', () => {
    const a = atom('a', 1.2)
    const floored = computed('floored', () => Math.floor(a.get()))
    const tens = vi.fn(() => floored.get() * 10)
    const derived = computed('tens', tens)
    expect(derived.get()).toBe(10)
    expect(tens).toHaveBeenCalledTimes(1)
    a.set(1.5)
    expect(derived.get()).toBe(10)
    expect(tens).toHaveBeenCalledTimes(1)
    a.set(2.5)
    expect(derived.get()).toBe(20)
    expect(tens).toHaveBeenCalledTimes(2)
  })

  it('never calls isEqual for the first computation', () => {
    const isEqual = vi.fn((x, y) => x === y)
    const a = atom('a', 1)
    const b = computed('b', () => a.get() * 2, { isEqual })
    expect(b.get()).toBe(2)
    expect(isEqual).not.toHaveBeenCalled()
    a.set(2)
    expect(b.get()).toBe(4)
    expect(isEqual).toHaveBeenCalledTimes(1)
  })

  it('never recomputes when the first run captured no parents', () => {
    const derive = vi.fn(() => 1)
    const c = computed('c', derive) as any
    const start = c.lastChangedEpoch
    expect(c.get()).toBe(1)
    expect(c.get()).toBe(1)
    const other = atom('other', 0)
    other.set(1)
    other.set(2)
    expect(c.get()).toBe(1)
    expect(derive).toHaveBeenCalledTimes(1)
    expect(c.parents.length).toBe(0)
    void start
  })

  it('caches a thrown value until a parent changes', () => {
    const a = atom('a', 1)
    const derive = vi.fn(() => {
      if (a.get() === 2) throw new Error('boom')
      return a.get()
    })
    const c = computed('c', derive)
    expect(c.get()).toBe(1)
    expect(derive).toHaveBeenCalledTimes(1)
    a.set(2)
    expect(() => c.get()).toThrow('boom')
    expect(() => c.get()).toThrow('boom')
    expect(() => c.get()).toThrow('boom')
    expect(derive).toHaveBeenCalledTimes(2)
    a.set(3)
    expect(c.get()).toBe(3)
  })

  it('entering the error state notifies effects but a second error does not', () => {
    const a = atom('a', 1)
    const derive = vi.fn(() => {
      if (a.get() % 2 === 0) throw new Error('boom')
      return a.get()
    })
    const c = computed('c', derive)
    const effect = vi.fn(() => {
      try {
        c.get()
      } catch {
        // intentional
      }
    })
    react('r', effect)
    expect(effect).toHaveBeenCalledTimes(1)
    a.set(2)
    expect(effect).toHaveBeenCalledTimes(2)
    a.set(4)
    expect(derive).toHaveBeenCalledTimes(3)
    expect(effect).toHaveBeenCalledTimes(2)
    a.set(3)
    expect(effect).toHaveBeenCalledTimes(3)
  })

  it('gives UNINITIALIZED as the previous value after an error', () => {
    const a = atom('a', 1)
    const seen: unknown[] = []
    const c = computed('c', (prev: unknown) => {
      seen.push(prev)
      if (a.get() === 2) throw new Error('boom')
      return a.get()
    })
    expect(c.get()).toBe(1)
    a.set(2)
    expect(() => c.get()).toThrow()
    a.set(3)
    expect(c.get()).toBe(3)
    expect(seen[2]).toBe(seen[0] === undefined ? seen[2] : seen[2])
    expect(String(seen[2])).toContain('UNINITIALIZED')
  })

  it('clears the history buffer when an error is thrown', () => {
    const a = atom('a', 1)
    const c = computed(
      'c',
      () => {
        if (a.get() === 2) throw new Error('boom')
        return a.get()
      },
      { historyLength: 4, computeDiff: (from: number, to: number) => to - from }
    )
    const start = getGlobalEpoch()
    expect(c.get()).toBe(1)
    a.set(3)
    expect(c.get()).toBe(3)
    a.set(2)
    expect(() => c.get()).toThrow()
    a.set(5)
    expect(c.get()).toBe(5)
    expect(c.getDiffSince(start)).toBe(RESET_VALUE)
  })

  it('does not throw out of haveParentsChanged when a parent throws', () => {
    const a = atom('a', 1)
    const thrower = computed('thrower', () => {
      if (a.get() === 2) throw new Error('boom')
      return a.get()
    })
    const safe = computed('safe', () => {
      try {
        return thrower.get()
      } catch {
        return -1
      }
    })
    let seen = 0
    react('r', () => {
      seen = safe.get()
    })
    expect(seen).toBe(1)
    expect(() => a.set(2)).not.toThrow()
    expect(seen).toBe(-1)
  })

  it('does not roll back an atom when a computed throws', () => {
    const a = atom('a', 1)
    const c = computed('c', () => {
      if (a.get() === 2) throw new Error('boom')
      return a.get()
    })
    expect(c.get()).toBe(1)
    a.set(2)
    expect(() => c.get()).toThrow()
    expect(a.get()).toBe(2)
  })

  it('captures nothing outside a reactive context', () => {
    const a = atom('a', 1)
    const c = computed('c', () => unsafe__withoutCapture(() => a.get())) as any
    react('r', () => c.get())
    expect(c.parents.length).toBe(0)
  })

  it('restores the capture context when the wrapped function throws', () => {
    const a = atom('a', 1)
    const b = atom('b', 2)
    const c = computed('c', () => {
      a.get()
      try {
        unsafe__withoutCapture(() => {
          throw new Error('boom')
        })
      } catch {
        // intentional
      }
      return a.get() + b.get()
    }) as any
    react('r', () => c.get())
    expect(c.parents.length).toBe(2)
  })

  it('rolls back atoms to their pre transaction values', () => {
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

  it('rolls back computed values too', () => {
    const a = atom('a', 1)
    const double = computed('double', () => a.get() * 2)
    expect(double.get()).toBe(2)
    transaction(rollback => {
      a.set(10)
      expect(double.get()).toBe(20)
      rollback()
    })
    expect(double.get()).toBe(2)
  })

  it('advances the global epoch when a transaction aborts', () => {
    const a = atom('a', 1)
    const before = getGlobalEpoch()
    transaction(rollback => {
      a.set(2)
      rollback()
    })
    expect(getGlobalEpoch()).toBeGreaterThan(before)
  })

  it('nested transactions roll back independently', () => {
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

  it('an outer rollback undoes a committed inner transaction', () => {
    const a = atom('a', 1)
    transaction(rollback => {
      transaction(() => {
        a.set(2)
      })
      rollback()
    })
    expect(a.get()).toBe(1)
  })

  it('aborts and rethrows when the function throws', () => {
    const a = atom('a', 1)
    expect(() =>
      transaction(() => {
        a.set(2)
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(a.get()).toBe(1)
  })

  it('transact joins the current transaction instead of nesting', () => {
    const a = atom('a', 1)
    transaction(() => {
      a.set(2)
      try {
        transact(() => {
          a.set(3)
          throw new Error('boom')
        })
      } catch {
        // intentional
      }
    })
    expect(a.get()).toBe(3)
  })

  it('defers effects until the transaction commits', () => {
    const a = atom('a', 1)
    const effect = vi.fn(() => a.get())
    react('r', effect)
    expect(effect).toHaveBeenCalledTimes(1)
    transact(() => {
      a.set(2)
      a.set(3)
      a.set(4)
      expect(effect).toHaveBeenCalledTimes(1)
    })
    expect(effect).toHaveBeenCalledTimes(2)
  })

  it('runs effects set during the reaction phase', () => {
    const a = atom('a', 0)
    const b = atom('b', 0)
    react('r', () => {
      b.set(a.get() + 1)
    })
    expect(b.get()).toBe(1)
    a.set(4)
    expect(b.get()).toBe(5)
  })

  it('throws when reactions loop forever', () => {
    expect(() => {
      const a = atom('a', 0)
      react('r', () => {
        a.set(a.get() + 1)
      })
    }).toThrow()
  })

  it('a reactor started without force does not run when nothing changed', () => {
    const a = atom('a', 1)
    const fn = vi.fn(() => a.get())
    const r = reactor('r', fn)
    r.start()
    expect(fn).toHaveBeenCalledTimes(1)
    r.stop()
    r.start()
    expect(fn).toHaveBeenCalledTimes(1)
    r.start({ force: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
