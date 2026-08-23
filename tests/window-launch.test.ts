import { describe, expect, it, vi } from 'vitest'
import { showWhenReady } from '../src/main/window-launch'

function launchWindow(destroyed = false) {
  let ready: (() => void) | undefined
  const win = {
    once: vi.fn((event: string, listener: () => void) => {
      if (event === 'ready-to-show') ready = listener
    }),
    isDestroyed: vi.fn(() => destroyed),
    show: vi.fn(),
    focus: vi.fn()
  }
  showWhenReady(win)
  return { win, ready: () => ready?.() }
}

describe('window launch', () => {
  it('keeps a new window hidden until its first frame is ready', () => {
    const { win, ready } = launchWindow()

    expect(win.show).not.toHaveBeenCalled()
    expect(win.focus).not.toHaveBeenCalled()

    ready()

    expect(win.show).toHaveBeenCalledOnce()
    expect(win.focus).toHaveBeenCalledOnce()
  })

  it('does not reveal a window that was closed while loading', () => {
    const { win, ready } = launchWindow(true)

    ready()

    expect(win.show).not.toHaveBeenCalled()
    expect(win.focus).not.toHaveBeenCalled()
  })
})
