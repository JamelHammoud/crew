// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadRow from '../src/renderer/src/components/sidebar/ThreadRow'
import type { LiveThread } from '../src/shared/threads'

const thread: LiveThread = {
  id: 'thread-1',
  title: 'Draw the footer…',
  working: false,
  preview: 'Draw the footer with the whole opening message, including every link and state.'
}

const row = () =>
  render(
    createElement(ThreadRow, {
      thread,
      open: false,
      here: true,
      placeKey: 'project:/work/crew',
      onOpen: () => {},
      onOpenToRight: () => {}
    })
  )

const hover = () => {
  const anchor = screen.getByRole('button', { name: thread.title }).parentElement as HTMLElement
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
    x: 20,
    y: 40,
    left: 20,
    top: 40,
    right: 250,
    bottom: 70,
    width: 230,
    height: 30,
    toJSON: () => ({})
  })
  fireEvent.mouseEnter(anchor)
  return anchor
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the opening message over a thread in the sidebar', () => {
  it('stands to the right after two seconds', () => {
    row()
    hover()

    act(() => vi.advanceTimersByTime(1999))
    expect(screen.queryByText(thread.preview!)).toBeNull()

    act(() => vi.advanceTimersByTime(1))
    const preview = screen.getByText(thread.preview!).closest('.glass') as HTMLElement
    expect(preview.style.width).toBe('380px')
    expect(preview.style.left).toBe('258px')
  })

  it('does not stand after the pointer leaves during the wait', () => {
    row()
    const anchor = hover()
    fireEvent.mouseLeave(anchor)

    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByText(thread.preview!)).toBeNull()
  })
})
