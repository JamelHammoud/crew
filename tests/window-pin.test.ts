import { describe, expect, it, vi } from 'vitest'
import { pinWindow, windowShapeOf, type PinnableWindow } from '../src/main/window-pin'

function windowState(input: { full?: boolean; maximized?: boolean; pinned?: boolean } = {}) {
  let pinned = input.pinned ?? false
  const win: PinnableWindow = {
    isAlwaysOnTop: () => pinned,
    isFullScreen: () => input.full ?? false,
    isMaximized: () => input.maximized ?? false,
    setAlwaysOnTop: vi.fn(next => {
      pinned = next
    })
  }
  return win
}

describe('window pinning', () => {
  it('keeps each window state on the window itself', () => {
    const first = windowState()
    const second = windowState()

    expect(pinWindow(first, true)).toBe(true)
    expect(first.isAlwaysOnTop()).toBe(true)
    expect(second.isAlwaysOnTop()).toBe(false)

    expect(pinWindow(first, false)).toBe(false)
    expect(first.isAlwaysOnTop()).toBe(false)
  })

  it('reports pinning beside the existing window shape', () => {
    expect(windowShapeOf(windowState({ pinned: true }))).toEqual({ square: false, full: false, pinned: true })
    expect(windowShapeOf(windowState({ maximized: true }))).toEqual({ square: true, full: false, pinned: false })
    expect(windowShapeOf(windowState({ full: true }))).toEqual({ square: true, full: true, pinned: false })
  })
})
