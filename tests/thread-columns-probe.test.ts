// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/src/App'
import { THREAD_STATE_LABELS } from '../src/renderer/src/components/thread'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'
import { VIEW_LIMIT } from '../src/shared/threadViews'
import { NO_UPDATE } from '../src/shared/update'
import { landed } from './helpers/boot'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
landed()

const popOutThread = vi.fn()

const agentNamed = (id: string, label: string): PooledAgent => ({
  id,
  label,
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
})

const CLAUDE = agentNamed('ali/claude', 'Claude')
const CODEX = agentNamed('ali/codex', 'Codex')

const started = (threadId: string, agent: PooledAgent, title: string): SessionEvent => ({
  id: `${threadId}-start`,
  ts: 1,
  kind: 'thread.started',
  threadId,
  agentId: agent.id,
  agentLabel: agent.label,
  title,
  byName: 'ALI'
})

const said = (threadId: string, agent: PooledAgent, text: string): SessionEvent => ({
  id: `${threadId}-message`,
  ts: 2,
  kind: 'message',
  authorId: 'ali',
  authorName: 'ALI',
  text,
  mentions: [agent.id],
  threadId
})

const HEADER = '@Claude look at the header'
const FOOTER = '@Codex look at the footer'

const events: SessionEvent[] = [
  started('thread-1', CLAUDE, HEADER),
  said('thread-1', CLAUDE, HEADER),
  started('thread-2', CODEX, FOOTER),
  said('thread-2', CODEX, FOOTER)
]

const threads = {
  'thread-1': {
    id: 'thread-1',
    agentId: CLAUDE.id,
    agentLabel: CLAUDE.label,
    title: HEADER,
    createdBy: 'ALI',
    status: 'open' as const,
    mode: 'build' as const
  },
  'thread-2': {
    id: 'thread-2',
    agentId: CODEX.id,
    agentLabel: CODEX.label,
    title: FOOTER,
    createdBy: 'ALI',
    status: 'open' as const,
    mode: 'build' as const
  }
}

const online = {
  connection: 'online' as const,
  place: 'project:here',
  selfId: 'ali',
  selfName: 'ALI',
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  agents: [CLAUDE, CODEX],
  events,
  threads,
  threadPrompts: {},
  threadDrafts: {},
  threadCommands: {},
  queues: {},
  steps: {},
  tokens: {},
  pending: {}
}

const THREAD_COMPOSER = 'Send a message or @ someone'
const CHAT_COMPOSER = 'Ask Crew'

const open = (ids: string[], focused: string | null): void => {
  useCrew.setState({ ...online, openThreadIds: ids, openThreadId: focused, chatColumn: false })
  render(createElement(App))
}

const openTasks = (): void => {
  const rows = screen.getAllByRole('button', { name: /^Tasks/ })
  fireEvent.click(rows[rows.length - 1])
}

const columns = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[data-column]'))

const background = (box: ParentNode): HTMLElement => box.querySelector<HTMLElement>('.overflow-y-auto')!

beforeEach(() => {
  popOutThread.mockClear()
  window.crew = {
    warmTerminal: () => undefined,
    popOutThread,
    onUpdate: () => () => {},
    updateState: async () => NO_UPDATE
  } as unknown as CrewBridge
  useBrowser.setState({ open: false })
})

afterEach(cleanup)

describe('several threads open side by side', () => {
  it('returns to chat and focuses its composer when the menu bar asks', () => {
    let openChat: (() => void) | undefined
    window.crew.onChatOpen = listener => {
      openChat = listener
      return () => undefined
    }
    open(['thread-1'], 'thread-1')

    act(() => openChat?.())

    expect(useCrew.getState().openThreadIds).toEqual([])
    expect(screen.getByPlaceholderText(CHAT_COMPOSER)).toBe(document.activeElement)
  })

  it('replaces the row when a system notification is opened', () => {
    let openNotification: ((threadId: string, place: string | null) => void) | undefined
    window.crew.onNotificationOpen = listener => {
      openNotification = listener
      return () => undefined
    }
    open(['thread-1'], 'thread-1')

    act(() => openNotification?.('thread-2', null))

    expect(useCrew.getState().openThreadIds).toEqual(['thread-2'])
    expect(useCrew.getState().openThreadId).toBe('thread-2')
    expect(columns()).toHaveLength(1)
  })

  it('goes back to the project a notification was raised in before opening it', async () => {
    let openNotification: ((threadId: string, place: string | null) => void) | undefined
    window.crew.onNotificationOpen = listener => {
      openNotification = listener
      return () => undefined
    }
    const asked: string[] = []
    window.crew.switchTo = async key => {
      asked.push(key)
      return null
    }
    open(['thread-1'], 'thread-1')

    await act(async () => openNotification?.('thread-2', 'project:there'))

    expect(asked).toEqual(['project:there'])
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('replaces the row when a task is opened from the task list', () => {
    open(['thread-1'], 'thread-1')

    openTasks()
    const task = screen.getAllByRole('button').find(button => button.textContent?.includes('look at the footer'))!
    fireEvent.click(task)

    expect(useCrew.getState().openThreadIds).toEqual(['thread-2'])
    expect(useCrew.getState().openThreadId).toBe('thread-2')
    expect(columns()).toHaveLength(1)
  })

  it('opens a task to the right from its right-click menu', () => {
    open(['thread-1'], 'thread-1')

    openTasks()
    const task = screen.getAllByRole('button').find(button => button.textContent?.includes('look at the footer'))!
    fireEvent.contextMenu(task)

    expect(screen.getByText('Open to right')).toBeTruthy()
    fireEvent.click(screen.getByText('Open to right'))

    expect(useCrew.getState().openThreadIds).toEqual(['thread-1', 'thread-2'])
    expect(useCrew.getState().openThreadId).toBe('thread-2')
    expect(columns()).toHaveLength(2)
  })

  it('draws a column each and takes the chat feed off the screen', () => {
    open(['thread-1', 'thread-2'], 'thread-1')

    expect(columns()).toHaveLength(2)
    expect(screen.getAllByPlaceholderText(THREAD_COMPOSER)).toHaveLength(2)
    expect(within(columns()[0]!).getAllByText('Claude').length).toBeGreaterThan(0)
    expect(within(columns()[1]!).getAllByText('Codex').length).toBeGreaterThan(0)
    expect(screen.queryByPlaceholderText(CHAT_COMPOSER)).toBeNull()
  })

  it('gives every column its own way out, and closing one leaves the other standing', () => {
    open(['thread-1', 'thread-2'], 'thread-1')

    const [first, second] = columns()
    const close = within(first!).getByLabelText('Close')
    expect(within(second!).getByLabelText('Close')).toBeTruthy()

    fireEvent.click(close)
    expect(useCrew.getState().openThreadIds).toEqual(['thread-2'])
    expect(useCrew.getState().openThreadId).toBe('thread-2')

    expect(columns()).toHaveLength(1)
    expect(within(columns()[0]!).getAllByText('Codex').length).toBeGreaterThan(0)
    expect(within(columns()[0]!).queryByText('Claude')).toBeNull()
    expect(screen.getByLabelText('Back to chat')).toBeTruthy()
  })

  it('puts the chat feed back once the last column has gone', () => {
    open(['thread-1'], 'thread-1')
    expect(screen.queryByPlaceholderText(CHAT_COMPOSER)).toBeNull()

    fireEvent.click(screen.getByLabelText('Back to chat'))
    expect(useCrew.getState().openThreadIds).toEqual([])
    expect(useCrew.getState().openThreadId).toBeNull()

    expect(columns()).toHaveLength(0)
    expect(screen.getByPlaceholderText(CHAT_COMPOSER)).toBeTruthy()
  })

  it('stands the way back to the panel in the top bar and in no column at all', () => {
    open(['thread-1', 'thread-2'], 'thread-2')
    act(() => useBrowser.getState().addTab())
    act(() => useBrowser.getState().closePanel())

    const [first, second] = columns()
    expect(screen.getAllByRole('button', { name: 'Show panel' })).toHaveLength(1)
    expect(within(first!).queryByRole('button', { name: 'Show panel' })).toBeNull()
    expect(within(second!).queryByRole('button', { name: 'Show panel' })).toBeNull()

    fireEvent.pointerDown(first!)
    expect(useCrew.getState().openThreadId).toBe('thread-1')
    expect(screen.getAllByRole('button', { name: 'Show panel' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Show panel' }))
    expect(useBrowser.getState().open).toBe(true)
    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull()
  })

  it('pops a column out from a right click on the thread itself', () => {
    open(['thread-1', 'thread-2'], 'thread-1')
    expect(screen.queryByLabelText('Open in window')).toBeNull()

    fireEvent.contextMenu(background(columns()[1]!))
    fireEvent.click(screen.getByText('Open in window'))
    expect(popOutThread).toHaveBeenLastCalledWith('thread-2', undefined)
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])

    fireEvent.contextMenu(background(columns()[0]!))
    fireEvent.click(screen.getByText('Open in window'))
    expect(popOutThread).toHaveBeenLastCalledWith('thread-1', undefined)
    expect(popOutThread).toHaveBeenCalledTimes(2)
  })

  it('says nothing of its own in a window standing on one thread', () => {
    useCrew.setState({ ...online, openThreadIds: ['thread-1'], openThreadId: 'thread-1' })
    render(createElement(ThreadView, { threadId: 'thread-1', alone: true }))

    fireEvent.contextMenu(background(document.body))
    expect(screen.queryByText('Open in window')).toBeNull()
  })

  it('opens the tenth and refuses the eleventh', () => {
    useCrew.setState({ openThreadIds: [], openThreadId: null })
    const ids = Array.from({ length: VIEW_LIMIT + 1 }, (_, i) => `row-${i + 1}`)

    for (const id of ids.slice(0, VIEW_LIMIT)) useCrew.getState().openThread(id)
    expect(useCrew.getState().openThreadIds).toEqual(ids.slice(0, VIEW_LIMIT))
    expect(useCrew.getState().openThreadId).toBe(`row-${VIEW_LIMIT}`)

    useCrew.getState().openThread(ids[VIEW_LIMIT]!)
    expect(useCrew.getState().openThreadIds).toHaveLength(VIEW_LIMIT)
    expect(useCrew.getState().openThreadIds).not.toContain(`row-${VIEW_LIMIT + 1}`)
    expect(useCrew.getState().openThreadId).toBe(`row-${VIEW_LIMIT}`)

    useCrew.getState().openThread('row-1')
    expect(useCrew.getState().openThreadIds).toHaveLength(VIEW_LIMIT)
    expect(useCrew.getState().openThreadId).toBe('row-1')
  })
})

describe('the chat standing beside a thread', () => {
  const reveal = (): void => {
    fireEvent.pointerMove(columns()[0]!, { clientX: 5000 })
  }
  const standing = (): HTMLElement | null =>
    document.querySelector<HTMLElement>('button[aria-pressed][aria-label="Chat"]')
  const slot = (): HTMLElement => {
    reveal()
    return standing()!
  }
  const chatColumn = (): HTMLElement => document.querySelector<HTMLElement>('[data-column="chat"]')!
  // The way into a card is the strand under it, which says where the thread has
  // got to. The reactions on the ask are buttons in the same card.
  const wayIn = (card: HTMLElement): HTMLElement =>
    within(card).getByRole('button', { name: new RegExp(THREAD_STATE_LABELS.ready) })

  it('stands the chat beside the thread and puts it away again', () => {
    open(['thread-1'], 'thread-1')
    expect(screen.queryByPlaceholderText(CHAT_COMPOSER)).toBeNull()

    fireEvent.click(slot())
    expect(useCrew.getState().chatColumn).toBe(true)
    expect(columns()).toHaveLength(2)
    expect(within(chatColumn()).getByPlaceholderText(CHAT_COMPOSER)).toBeTruthy()

    fireEvent.click(slot())
    expect(useCrew.getState().chatColumn).toBe(false)
    expect(columns()).toHaveLength(1)
    expect(screen.queryByPlaceholderText(CHAT_COMPOSER)).toBeNull()
  })

  it('opens a card from it beside what is already there', () => {
    open(['thread-1'], 'thread-1')
    fireEvent.click(slot())

    const card = chatColumn().querySelector<HTMLElement>('[data-thread="thread-2"]')!
    fireEvent.click(wayIn(card))

    expect(useCrew.getState().openThreadIds).toEqual(['thread-1', 'thread-2'])
    expect(useCrew.getState().openThreadId).toBe('thread-2')
    expect(useCrew.getState().chatColumn).toBe(true)
  })

  it('says beside on a card, now that the feed can stand with a column', () => {
    open(['thread-1'], 'thread-1')
    fireEvent.click(slot())

    const card = chatColumn().querySelector<HTMLElement>('[data-thread="thread-2"]')!
    fireEvent.contextMenu(card)

    expect(screen.getByText('Open to right')).toBeTruthy()
    expect(screen.queryByText('Open')).toBeNull()
  })

  it('leaves no way in once the row is full', () => {
    open(
      Array.from({ length: VIEW_LIMIT }, (_, i) => `row-${i + 1}`),
      'row-1'
    )
    reveal()
    expect(standing()).toBeNull()
  })

  it('stands out of the way until the pointer comes near the right', () => {
    open(['thread-1'], 'thread-1')
    expect(standing()).toBeNull()

    reveal()
    expect(standing()).toBeTruthy()
  })

  it('goes with the last column', () => {
    open(['thread-1'], 'thread-1')
    fireEvent.click(slot())

    fireEvent.click(within(columns()[0]!).getByLabelText('Close'))
    expect(useCrew.getState().openThreadIds).toEqual([])
    expect(useCrew.getState().chatColumn).toBe(false)
    expect(columns()).toHaveLength(0)
    expect(screen.getByPlaceholderText(CHAT_COMPOSER)).toBeTruthy()
  })
})

describe('the right click on a card in the feed', () => {
  const card = (title: string): HTMLElement =>
    screen.getAllByRole('button').find(one => one.textContent?.includes(title))!

  it('opens the thread, and the feed only ever stands with the row empty', () => {
    open([], null)
    fireEvent.contextMenu(card('look at the header'))

    expect(screen.getByText('Open')).toBeTruthy()
    expect(screen.queryByText('Open to right')).toBeNull()

    fireEvent.click(screen.getByText('Open'))
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('pops one out without it standing in both places at once', () => {
    open([], null)
    fireEvent.contextMenu(card('look at the footer'))
    fireEvent.click(screen.getByText('Open in window'))

    expect(popOutThread).toHaveBeenLastCalledWith('thread-2', undefined)
    expect(useCrew.getState().openThreadIds).toEqual([])
  })
})
