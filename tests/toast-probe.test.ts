// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorage } from './helpers/local-storage'

installLocalStorage()

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []

const { default: Toaster } = await import('../src/renderer/src/components/Toaster')
const { clearToasts, holdToasts, toast, TOAST_OUT_MS } = await import('../src/renderer/src/state/toast')

const show = () => render(createElement(Toaster))

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

const rows = () => document.querySelectorAll('.toast-row')

describe('toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      holdToasts(false)
      clearToasts()
    })
    tick(TOAST_OUT_MS + 10)
    cleanup()
    vi.useRealTimers()
  })

  it('says one thing and takes itself down', () => {
    show()
    act(() => {
      toast('Copied')
    })
    expect(screen.getByText('Copied')).toBeTruthy()

    tick(4000)
    expect(rows()[0].hasAttribute('data-leaving')).toBe(true)
    tick(TOAST_OUT_MS)
    expect(screen.queryByText('Copied')).toBe(null)
  })

  it('stacks the newest on top and keeps four', () => {
    show()
    act(() => {
      for (const word of ['One', 'Two', 'Three', 'Four', 'Five']) toast(word)
    })
    const said = [...document.querySelectorAll('.toast-row p')].map(p => p.textContent)
    expect(said.slice(0, 4)).toEqual(['Five', 'Four', 'Three', 'Two'])

    // The oldest is on its way out rather than gone the moment it is pushed off.
    expect(said[4]).toBe('One')
    tick(TOAST_OUT_MS)
    expect(screen.queryByText('One')).toBe(null)
  })

  it('one row per key, rewritten where it stands', () => {
    show()
    act(() => {
      toast('Working', { key: 'sync' })
      toast('Warm', { key: 'other' })
      toast('Nearly there', { key: 'sync' })
    })
    expect(rows().length).toBe(2)
    expect(screen.queryByText('Working')).toBe(null)
    expect(screen.getByText('Nearly there')).toBeTruthy()
    // It stays where it was rather than jumping to the top of the stack.
    expect(document.querySelectorAll('.toast-row p')[1].textContent).toBe('Nearly there')
  })

  it('a busy one waits for what it is about', () => {
    show()
    let handle: ReturnType<typeof toast> | null = null
    act(() => {
      handle = toast.busy('Sharing')
    })
    tick(60_000)
    expect(screen.getByText('Sharing')).toBeTruthy()

    act(() => handle!.done('Link copied'))
    expect(screen.getByText('Link copied')).toBeTruthy()
    tick(4000 + TOAST_OUT_MS)
    expect(screen.queryByText('Link copied')).toBe(null)
  })

  it('says its piece even if its row went while the work was going', () => {
    show()
    let handle: ReturnType<typeof toast> | null = null
    act(() => {
      handle = toast('Sending')
    })
    tick(4000 + TOAST_OUT_MS)
    expect(screen.queryByText('Sending')).toBe(null)

    act(() => handle!.fail('That did not send'))
    expect(screen.getByText('That did not send')).toBeTruthy()
    expect(document.querySelector('[role="alert"]')).toBeTruthy()
  })

  it('nothing more comes of a handle that was closed', () => {
    show()
    let handle: ReturnType<typeof toast> | null = null
    act(() => {
      handle = toast.busy('Sharing')
    })
    act(() => handle!.close())
    tick(TOAST_OUT_MS)
    act(() => handle!.done('Link copied'))
    expect(rows().length).toBe(0)
  })

  it('the pointer resting on the stack holds the clock', () => {
    const view = show()
    act(() => {
      toast('Copied')
    })
    const stack = document.querySelector('.toast-row')!.parentElement!
    fireEvent.pointerEnter(stack)
    tick(20_000)
    expect(screen.getByText('Copied')).toBeTruthy()

    fireEvent.pointerLeave(stack)
    tick(4000 + TOAST_OUT_MS)
    expect(screen.queryByText('Copied')).toBe(null)
    view.unmount()
  })

  it('a button on it does the thing and takes the row away', () => {
    show()
    const pressed = vi.fn()
    act(() => {
      toast('Playlist deleted', { action: { label: 'Undo', onPress: pressed } })
    })
    fireEvent.click(screen.getByText('Undo'))
    expect(pressed).toHaveBeenCalledTimes(1)
    tick(TOAST_OUT_MS)
    expect(screen.queryByText('Playlist deleted')).toBe(null)
  })

  it('a row with nothing to do is taken away by a press', () => {
    show()
    act(() => {
      toast.fail('Could not share the session.')
    })
    fireEvent.click(screen.getByRole('alert'))
    tick(TOAST_OUT_MS)
    expect(rows().length).toBe(0)
  })

  it('the whole row is the way into what it is about, not the button alone', () => {
    show()
    const pressed = vi.fn()
    act(() => {
      toast('Bubbles finished', { action: { label: 'Open', onPress: pressed } })
    })
    fireEvent.click(screen.getByText('Bubbles finished'))
    expect(pressed).toHaveBeenCalledTimes(1)
    tick(TOAST_OUT_MS)
    expect(rows().length).toBe(0)
  })

  it('a row that keeps its place says its piece and stays', () => {
    show()
    const pressed = vi.fn()
    act(() => {
      toast('Sharing the session', { action: { label: 'Copy link', onPress: pressed, keep: true } })
    })
    fireEvent.click(screen.getByText('Copy link'))
    tick(TOAST_OUT_MS)
    expect(pressed).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sharing the session')).toBeTruthy()
  })

  // A hand drifts while it presses, and the distance that starts a drag is short
  // enough that an ordinary press has already crossed it. Read as a gesture, the
  // press was thrown away and the row did nothing at all.
  it('a press that drifted a few pixels is still a press', () => {
    show()
    const pressed = vi.fn()
    act(() => {
      toast('Bubbles finished', { action: { label: 'Open', onPress: pressed } })
    })
    act(() => {
      const card = document.querySelector('.toast-card')!
      fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(card, { pointerId: 1, clientX: 8 })
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 8 })
      fireEvent.click(screen.getByText('Open'))
    })
    expect(pressed).toHaveBeenCalledTimes(1)
  })

  const swipe = (to: number) => {
    const card = document.querySelector('.toast-card')!
    fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 0 })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: to })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: to })
    return card
  }

  it('a row is swiped out of the way to the right', () => {
    show()
    act(() => {
      toast('Copied')
    })
    act(() => void swipe(140))
    tick(TOAST_OUT_MS)
    expect(screen.queryByText('Copied')).toBe(null)
  })

  it('a swipe that did not go far enough springs back', () => {
    show()
    act(() => {
      toast('Copied')
    })
    act(() => void swipe(24))
    tick(TOAST_OUT_MS)
    expect(screen.getByText('Copied')).toBeTruthy()
    expect(document.querySelector<HTMLElement>('.toast-card')!.style.transform).toBe('translateX(0px)')
  })

  it('pulling the other way leaves it where it stands', () => {
    show()
    act(() => {
      toast('Copied')
    })
    act(() => void swipe(-140))
    tick(TOAST_OUT_MS)
    expect(screen.getByText('Copied')).toBeTruthy()
  })

  it('a swipe is not a press, so nothing on the row is pressed by it', () => {
    show()
    const pressed = vi.fn()
    act(() => {
      toast('Playlist deleted', { action: { label: 'Undo', onPress: pressed, keep: true } })
    })
    act(() => {
      const card = document.querySelector('.toast-card')!
      fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 0 })
      fireEvent.pointerMove(card, { pointerId: 1, clientX: 30 })
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 30 })
      fireEvent.click(screen.getByText('Undo'))
      fireEvent.click(card)
    })
    tick(TOAST_OUT_MS)
    expect(pressed).not.toHaveBeenCalled()
    expect(screen.getByText('Playlist deleted')).toBeTruthy()
  })

  // A flick lands well short of the distance a press may drift, so the row going
  // is what says it was a gesture rather than how far it got.
  it('a flick brushes the row aside without pressing it', () => {
    show()
    const pressed = vi.fn()
    act(() => {
      toast('Bubbles finished', { action: { label: 'Open', onPress: pressed } })
    })
    // How fast it went is read over a window of time, so the clock the gesture
    // is measured against is the one thing this has to hold still.
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    act(() => {
      const card = document.querySelector('.toast-card')!
      fireEvent.pointerDown(card, { button: 0, pointerId: 1, clientX: 0 })
      now = 30
      fireEvent.pointerMove(card, { pointerId: 1, clientX: 15 })
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 15 })
      fireEvent.click(card)
    })
    clock.mockRestore()
    tick(TOAST_OUT_MS)
    expect(pressed).not.toHaveBeenCalled()
    expect(rows().length).toBe(0)
  })

  it('the last row going under the pointer hands the clocks back', () => {
    show()
    act(() => {
      toast('Copied')
    })
    const stack = document.querySelector('.toast-row')!.parentElement!
    fireEvent.pointerEnter(stack)
    act(() => void swipe(140))
    tick(TOAST_OUT_MS)

    act(() => {
      toast('Copied again')
    })
    tick(4000 + TOAST_OUT_MS)
    expect(screen.queryByText('Copied again')).toBe(null)
  })

  it('nothing stands in the body while there is nothing to say', () => {
    show()
    expect(document.body.querySelector('.toast-row')).toBe(null)
  })
})
