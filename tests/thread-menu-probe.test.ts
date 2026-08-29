// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadRow from '../src/renderer/src/components/sidebar/ThreadRow'
import { ownsMenu, useThreadMenu } from '../src/renderer/src/components/threadMenu'
import { CrewSocket } from '../src/renderer/src/api/ws'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import { setWindowPinned } from '../src/renderer/src/state/windowShape'
import type { LiveThread } from '../src/shared/threads'

const popOutThread = vi.fn()
const pinWindow = vi.fn(async (pinned: boolean) => pinned)
const onOpen = vi.fn()
const onOpenToRight = vi.fn()
const written = vi.fn(async () => {})
const sent = vi.spyOn(CrewSocket.prototype, 'send').mockImplementation(() => {})

Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: written } })

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

const thread: LiveThread = {
  id: 'thread-2',
  title: 'Draw the footer',
  working: false,
  preview: 'Draw the footer with the whole opening message'
}

const row = (open: boolean, here = true, placeKey = HERE): void => {
  render(createElement(ThreadRow, { thread, open, here, placeKey, onOpen, onOpenToRight }))
  fireEvent.contextMenu(screen.getByText('Draw the footer'))
}

const rows = (): string[] =>
  Array.from(document.querySelectorAll('[role="menuitem"], button'))
    .map(one => one.textContent ?? '')
    .filter(text => text.startsWith('Open') || text === 'Close')

const said = (): string[] =>
  Array.from(document.querySelectorAll('[role="menuitem"], button')).map(one => one.textContent ?? '')

beforeEach(() => {
  popOutThread.mockClear()
  pinWindow.mockClear()
  onOpen.mockClear()
  onOpenToRight.mockClear()
  written.mockClear()
  sent.mockClear()
  window.crew = { popOutThread, setWindowPinned: pinWindow } as unknown as CrewBridge
  setWindowPinned(false)
  useCrew.setState({ openThreadIds: ['thread-1'], openThreadId: 'thread-1', threads: meta('open') })
})

afterEach(() => {
  cleanup()
  setWindowPinned(false)
})

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

  it('marks one done from the rail', () => {
    row(false)

    fireEvent.click(screen.getByText('Mark done'))
    expect(sent).toHaveBeenCalledWith({ type: 'thread.status', threadId: 'thread-2', status: 'done' })
  })

  it('archives one from the rail', () => {
    row(false)

    fireEvent.click(screen.getByText('Archive thread'))
    expect(sent).toHaveBeenCalledWith({ type: 'thread.archive', threadId: 'thread-2' })
  })

  it('offers the way back once a thread is done', () => {
    useCrew.setState({ threads: meta('done') })
    row(false)

    expect(said()).toContain('Reopen')
    expect(said()).not.toContain('Mark done')
    fireEvent.click(screen.getByText('Reopen'))
    expect(sent).toHaveBeenCalledWith({ type: 'thread.status', threadId: 'thread-2', status: 'open' })
  })

  it('leaves a thread of another project to be finished where it lives', () => {
    row(false, false, AWAY)

    expect(said()).not.toContain('Mark done')
    expect(said()).not.toContain('Archive thread')
  })

  it('puts the id on the clipboard', async () => {
    row(false)

    fireEvent.click(screen.getByText('Copy thread ID'))
    await vi.waitFor(() => expect(written).toHaveBeenCalledWith('thread-2'))
  })

  it('offers the id for a thread of another project too', () => {
    row(false, false, AWAY)

    expect(said()).toContain('Copy thread ID')
  })

  it('hands the press back where words are already selected, since that is where Copy lives', () => {
    const held = vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'Draw the footer'
    } as unknown as Selection)

    render(createElement(ThreadRow, { thread, open: false, here: true, placeKey: HERE, onOpen, onOpenToRight }))
    const press = createEvent.contextMenu(screen.getByText('Draw the footer'))
    fireEvent(screen.getByText('Draw the footer'), press)

    expect(press.defaultPrevented).toBe(false)
    expect(rows()).toEqual([])
    expect(said()).not.toContain('Copy thread ID')
    held.mockRestore()
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

  function Background({ alone = false }: { alone?: boolean }) {
    const openMenu = useThreadMenu({
      threadId: 'thread-2',
      status: true,
      opening: !alone,
      windowPin: true,
      onOpen
    })
    return createElement(
      'div',
      null,
      createElement('div', { onContextMenu: openMenu.onContextMenu }, 'Chat background'),
      openMenu.menu
    )
  }

  it('keeps the window on top from the chat background and releases it there too', async () => {
    render(createElement(Background))

    fireEvent.contextMenu(screen.getByText('Chat background'))
    expect(screen.getByText('Open in window')).toBeTruthy()
    fireEvent.click(screen.getByText('Keep on top'))
    await vi.waitFor(() => expect(pinWindow).toHaveBeenCalledWith(true))

    fireEvent.contextMenu(screen.getByText('Chat background'))
    fireEvent.click(screen.getByText('Stop keeping on top'))
    await vi.waitFor(() => expect(pinWindow).toHaveBeenCalledWith(false))
  })

  it('keeps the pin action on a popped-out thread without offering to open another window', () => {
    render(createElement(Background, { alone: true }))

    fireEvent.contextMenu(screen.getByText('Chat background'))
    expect(screen.getByText('Keep on top')).toBeTruthy()
    expect(screen.queryByText('Open in window')).toBeNull()
  })

  it('marks done and archives from the chat background', () => {
    render(createElement(Background))

    fireEvent.contextMenu(screen.getByText('Chat background'))
    fireEvent.click(screen.getByText('Mark done'))
    expect(sent).toHaveBeenCalledWith({ type: 'thread.status', threadId: 'thread-2', status: 'done' })

    fireEvent.contextMenu(screen.getByText('Chat background'))
    fireEvent.click(screen.getByText('Archive thread'))
    expect(sent).toHaveBeenCalledWith({ type: 'thread.archive', threadId: 'thread-2' })
  })
})
