import { describe, expect, it } from 'vitest'
import { Awake } from '../src/shared/awake'

describe('keeping the machine awake', () => {
  it('sleeps until somebody asks', () => {
    const asking = new Awake()
    expect(asking.on).toBe(false)
    expect(asking.wants(1, true)).toBe(true)
    expect(asking.on).toBe(true)
  })

  it('says so only when the answer really moved', () => {
    const asking = new Awake()
    asking.wants(1, true)
    expect(asking.wants(1, true)).toBeNull()
    expect(asking.wants(1, false)).toBe(false)
    expect(asking.wants(1, false)).toBeNull()
  })

  // Several windows on one folder is normal here, and the machine is one
  // machine, so the last one to stop asking is what lets go of it.
  it('stays up while any window is asking', () => {
    const asking = new Awake()
    asking.wants(1, true)
    expect(asking.wants(2, true)).toBeNull()
    expect(asking.wants(1, false)).toBeNull()
    expect(asking.on).toBe(true)
    expect(asking.wants(2, false)).toBe(false)
  })

  it('lets go of a window that died with the switch on', () => {
    const asking = new Awake()
    asking.wants(1, true)
    asking.wants(2, true)
    expect(asking.forget(2)).toBeNull()
    expect(asking.forget(1)).toBe(false)
    expect(asking.on).toBe(false)
  })

  it('makes nothing of a window that never asked', () => {
    const asking = new Awake()
    asking.wants(1, true)
    expect(asking.forget(9)).toBeNull()
    expect(asking.on).toBe(true)
  })
})
