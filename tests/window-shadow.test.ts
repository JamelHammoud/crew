import { describe, expect, it, vi } from 'vitest'
import { setWindowShadow } from '../src/main/window-shadow'

function windowState(shadow: boolean, visible = true, focused = true) {
  let current = shadow
  const win = {
    hasShadow: vi.fn(() => current),
    hide: vi.fn(),
    invalidateShadow: vi.fn(),
    isFocused: vi.fn(() => focused),
    isVisible: vi.fn(() => visible),
    setHasShadow: vi.fn((next: boolean) => {
      current = next
    }),
    show: vi.fn(),
    showInactive: vi.fn()
  }
  return win
}

describe('the native window shadow', () => {
  it('leaves a window alone when its shadow already matches', () => {
    const win = windowState(false)

    setWindowShadow('darwin', win, false)

    expect(win.setHasShadow).not.toHaveBeenCalled()
    expect(win.hide).not.toHaveBeenCalled()
  })

  it('adds a shadow without taking a visible window down', () => {
    const win = windowState(false)

    setWindowShadow('darwin', win, true)

    expect(win.setHasShadow).toHaveBeenCalledWith(true)
    expect(win.invalidateShadow).toHaveBeenCalledOnce()
    expect(win.hide).not.toHaveBeenCalled()
  })

  it('takes a focused window down while removing its shadow and restores it', () => {
    const win = windowState(true)

    setWindowShadow('darwin', win, false)

    expect(win.hide).toHaveBeenCalledOnce()
    expect(win.setHasShadow).toHaveBeenCalledWith(false)
    expect(win.invalidateShadow).toHaveBeenCalledOnce()
    expect(win.show).toHaveBeenCalledOnce()
    expect(win.showInactive).not.toHaveBeenCalled()
  })

  it('restores an unfocused window without taking focus', () => {
    const win = windowState(true, true, false)

    setWindowShadow('darwin', win, false)

    expect(win.show).not.toHaveBeenCalled()
    expect(win.showInactive).toHaveBeenCalledOnce()
  })

  it('does not show a window that was already hidden', () => {
    const win = windowState(true, false)

    setWindowShadow('darwin', win, false)

    expect(win.hide).not.toHaveBeenCalled()
    expect(win.show).not.toHaveBeenCalled()
    expect(win.showInactive).not.toHaveBeenCalled()
  })

  it('does not change native shadows outside macOS', () => {
    const win = windowState(true)

    setWindowShadow('win32', win, false)

    expect(win.setHasShadow).not.toHaveBeenCalled()
  })
})
