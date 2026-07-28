import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootSeen, rememberBoot } from '../src/renderer/src/components/boot/seen'

const store = new Map<string, string>()
const held = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('sessionStorage', held)
  vi.stubEnv('DEV', true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the flight in dev', () => {
  it('flies the first time a window is opened', () => {
    expect(bootSeen()).toBe(false)
  })

  it('lands straight in the app once it has been watched', () => {
    rememberBoot()
    expect(bootSeen()).toBe(true)
  })

  it('flies again in a window that has not watched it', () => {
    rememberBoot()
    store.clear()
    expect(bootSeen()).toBe(false)
  })

  it('flies every time in a build people run', () => {
    vi.stubEnv('DEV', false)
    rememberBoot()
    expect(bootSeen()).toBe(false)
    expect(store.size).toBe(0)
  })

  it('holds nothing against a window with nowhere to remember it', () => {
    vi.stubGlobal('sessionStorage', undefined)
    expect(bootSeen()).toBe(false)
    expect(() => rememberBoot()).not.toThrow()
  })
})
