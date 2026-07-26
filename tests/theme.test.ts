// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, storedTheme, toggleTheme } from '../src/renderer/src/state/theme'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
})

describe('theme', () => {
  beforeEach(() => {
    store.clear()
    document.documentElement.classList.remove('light')
  })

  it('defaults to dark when nothing is stored', () => {
    expect(storedTheme()).toBe('dark')
  })

  it('applies light mode to the document and stores it', () => {
    applyTheme('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(storedTheme()).toBe('light')
  })

  it('switches back to dark and stores it', () => {
    applyTheme('light')
    applyTheme('dark')
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(storedTheme()).toBe('dark')
  })

  it('treats unknown stored values as dark', () => {
    store.set('crew.theme', 'zebra')
    expect(storedTheme()).toBe('dark')
    applyTheme(storedTheme())
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  describe('turning it over', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      document.documentElement.classList.remove('theming')
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('goes to the other theme and stores it', () => {
      toggleTheme()
      expect(storedTheme()).toBe('light')
      toggleTheme()
      expect(storedTheme()).toBe('dark')
    })

    it('crosses to the new colors rather than cutting to them', () => {
      toggleTheme()
      expect(document.documentElement.classList.contains('theming')).toBe(true)
    })

    it('takes the fade away again, so nothing lags behind it', () => {
      toggleTheme()
      vi.advanceTimersByTime(1000)
      expect(document.documentElement.classList.contains('theming')).toBe(false)
    })

    it('draws the theme it boots in rather than arriving at it', () => {
      store.set('crew.theme', 'light')
      applyTheme(storedTheme())
      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('theming')).toBe(false)
    })
  })
})
