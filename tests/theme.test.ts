// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, storedTheme } from '../src/renderer/src/state/theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
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
    localStorage.setItem('crew.theme', 'zebra')
    expect(storedTheme()).toBe('dark')
    applyTheme(storedTheme())
    expect(document.documentElement.classList.contains('light')).toBe(false)
  })
})
