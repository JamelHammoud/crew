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

  it('closes on the mark at the end of the row', () => {
    show()
    act(() => {
      toast.fail('Could not share the session.')
    })
    fireEvent.click(screen.getByLabelText('Close'))
    tick(TOAST_OUT_MS)
    expect(rows().length).toBe(0)
  })

  it('nothing stands in the body while there is nothing to say', () => {
    show()
    expect(document.body.querySelector('.toast-row')).toBe(null)
  })
})
