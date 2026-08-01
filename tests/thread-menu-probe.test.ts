// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadRow from '../src/renderer/src/components/sidebar/ThreadRow'
import { useCrew } from '../src/renderer/src/state/store'
import type { LiveThread } from '../src/shared/threads'

const popOutThread = vi.fn()
const onOpen = vi.fn()

const HERE = 'project:/work/crew'
const AWAY = 'project:/work/site'

const thread: LiveThread = { id: 'thread-2', title: 'Draw the footer', working: false }

const row = (open: boolean, here = true, placeKey = HERE): void => {
  render(createElement(ThreadRow, { thread, open, here, placeKey, onOpen }))
  fireEvent.contextMenu(screen.getByText('Draw the footer'))
}

const rows = (): string[] =>
  Array.from(document.querySelectorAll('[role="menuitem"], button')).
    map(one => one.textContent ?? '').
    filter(text => text.startsWith('Open') || text === 'Close')

beforeEach(() => {
  popOutThread.mockClear()
  onOpen.mockClear()
  window.crew = { popOutThread } as unknown as CrewBridge
  useCrew.setState({ openThreadIds: ['thread-1'], openThreadId: 'thread-1' })
})

afterEach(cleanup)

describe('the right click on a thread in the rail', () => {
  it('opens one beside the row rather than in place of it', () => {
    row(false)

    expect(rows()).toContain('Open beside')
    fireEvent.click(screen.getByText('Open beside'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('is a window of its own or the way out for one already in the row', () => {
    useCrew.setState({ openThreadIds: ['thread-1', 'thread-2'], openThreadId: 'thread-1' })
    row(true)

    expect(rows()).not.toContain('Open beside')
    fireEvent.click(screen.getByText('Close'))
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('takes the column with the press when a thread in the row is popped out', () => {
    useCrew.setState({ openThreadIds: ['thread-1', 'thread-2'], openThreadId: 'thread-2' })
    row(true)

    fireEvent.click(screen.getByText('Open in its own window'))
    expect(popOutThread).toHaveBeenCalledWith('thread-2', HERE)
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('names the crew a thread of another project belongs to, and leaves this row alone', () => {
    row(false, false, AWAY)

    expect(rows()).toEqual(['Open', 'Open in its own window'])
    fireEvent.click(screen.getByText('Open in its own window'))
    expect(popOutThread).toHaveBeenCalledWith('thread-2', AWAY)
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })
})
