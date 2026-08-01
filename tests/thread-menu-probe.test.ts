// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadRow from '../src/renderer/src/components/sidebar/ThreadRow'
import { ownsMenu } from '../src/renderer/src/components/threadMenu'
import { CrewSocket } from '../src/renderer/src/api/ws'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { LiveThread } from '../src/shared/threads'

const popOutThread = vi.fn()
const onOpen = vi.fn()
const onOpenToRight = vi.fn()
const sent = vi.spyOn(CrewSocket.prototype, 'send').mockImplementation(() => {})

const meta = (status: ThreadMeta['status']): Record<string, ThreadMeta> => ({
  'thread-2': {
    id: 'thread-2',
    agentId: 'agent-1',
    agentLabel: 'Bubbles',
    title: 'Draw the footer',
    createdBy: 'Jamel',
    status,
    mode: 'build'
  }
})

const HERE = 'project:/work/crew'
const AWAY = 'project:/work/site'

const thread: LiveThread = { id: 'thread-2', title: 'Draw the footer', working: false }

const row = (open: boolean, here = true, placeKey = HERE): void => {
  render(createElement(ThreadRow, { thread, open, here, placeKey, onOpen, onOpenToRight }))
  fireEvent.contextMenu(screen.getByText('Draw the footer'))
}

const rows = (): string[] =>
  Array.from(document.querySelectorAll('[role="menuitem"], button')).
    map(one => one.textContent ?? '').
    filter(text => text.startsWith('Open') || text === 'Close')

beforeEach(() => {
  popOutThread.mockClear()
  onOpen.mockClear()
  onOpenToRight.mockClear()
  window.crew = { popOutThread } as unknown as CrewBridge
  useCrew.setState({ openThreadIds: ['thread-1'], openThreadId: 'thread-1' })
})

afterEach(cleanup)

describe('the right click on a thread in the rail', () => {
  it('opens one to the right rather than in place of it', () => {
    row(false)

    expect(rows()).toContain('Open to right')
    fireEvent.click(screen.getByText('Open to right'))
    expect(onOpenToRight).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('is a window of its own or the way out for one already in the row', () => {
    useCrew.setState({ openThreadIds: ['thread-1', 'thread-2'], openThreadId: 'thread-1' })
    row(true)

    expect(rows()).not.toContain('Open to right')
    fireEvent.click(screen.getByText('Close'))
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('takes the column with the press when a thread in the row is popped out', () => {
    useCrew.setState({ openThreadIds: ['thread-1', 'thread-2'], openThreadId: 'thread-2' })
    row(true)

    fireEvent.click(screen.getByText('Open in window'))
    expect(popOutThread).toHaveBeenCalledWith('thread-2', HERE)
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('names the crew a thread of another project belongs to, and leaves this row alone', () => {
    row(false, false, AWAY)

    expect(rows()).toEqual(['Open', 'Open in window'])
    fireEvent.click(screen.getByText('Open in window'))
    expect(popOutThread).toHaveBeenCalledWith('thread-2', AWAY)
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })
})

describe('a right click on the thread itself', () => {
  const under = (html: string): Element => {
    const box = document.createElement('div')
    box.innerHTML = html
    return box.firstElementChild!
  }

  it('leaves what already answers a right click to answer it', () => {
    expect(ownsMenu(under('<a href="https://crew.dev">crew</a>'))).toBe(true)
    expect(ownsMenu(under('<img alt="a shot" />'))).toBe(true)
    expect(ownsMenu(under('<textarea></textarea>'))).toBe(true)
    expect(ownsMenu(under('<div contenteditable="true">a doc</div>'))).toBe(true)
  })

  it('reads what the press really landed on rather than the box it was in', () => {
    expect(ownsMenu(under('<a href="https://crew.dev"><span>crew</span></a>').firstElementChild)).toBe(true)
    expect(ownsMenu(under('<p>what an agent said</p>'))).toBe(false)
    expect(ownsMenu(null)).toBe(false)
  })
})
