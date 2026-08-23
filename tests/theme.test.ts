// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, storedTheme, toggleTheme } from '../src/renderer/src/state/theme'

const store = new Map<string, string>()
const setTheme = vi.fn()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
})

describe('theme', () => {
  beforeEach(() => {
    store.clear()
    setTheme.mockClear()
    Object.defineProperty(window, 'crew', { value: { setTheme }, configurable: true })
    document.documentElement.classList.remove('light', 'oled')
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

  it('applies OLED without presenting it as light to the document', () => {
    applyTheme('oled')
    expect(document.documentElement.classList.contains('oled')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(storedTheme()).toBe('oled')
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('clears OLED when another theme is picked', () => {
    applyTheme('oled')
    applyTheme('light')
    expect(document.documentElement.classList.contains('oled')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('treats unknown stored values as dark', () => {
    store.set('crew.theme', 'zebra')
    expect(storedTheme()).toBe('dark')
    applyTheme(storedTheme())
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })

  describe('turning it over', () => {
    it('goes to the other theme and stores it', () => {
      toggleTheme()
      expect(storedTheme()).toBe('light')
      toggleTheme()
      expect(storedTheme()).toBe('dark')
    })

    it('lands on the new colors at once, with nothing left easing behind it', () => {
      toggleTheme()
      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('theming')).toBe(false)
    })
  })
})
