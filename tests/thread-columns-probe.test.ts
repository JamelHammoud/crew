// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/src/App'
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
const CHAT_COMPOSER = 'Send a message, @ someone, or / for a command'

const open = (ids: string[], focused: string | null): void => {
  useCrew.setState({ ...online, openThreadIds: ids, openThreadId: focused, chatColumn: false })
  render(createElement(App))
}

const columns = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('[data-column]'))

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

  it('stands the panel button in the focused column and nowhere else', () => {
    open(['thread-1', 'thread-2'], 'thread-2')

    const [first, second] = columns()
    expect(screen.getAllByLabelText('Show panel')).toHaveLength(1)
    expect(within(first!).queryByLabelText('Show panel')).toBeNull()
    expect(within(second!).getByLabelText('Show panel')).toBeTruthy()

    fireEvent.pointerDown(first!)
    expect(useCrew.getState().openThreadId).toBe('thread-1')
    expect(screen.getAllByLabelText('Show panel')).toHaveLength(1)
    expect(within(first!).getByLabelText('Show panel')).toBeTruthy()
    expect(within(second!).queryByLabelText('Show panel')).toBeNull()
  })

  it('carries the pop out in every column, each naming its own thread', () => {
    open(['thread-1', 'thread-2'], 'thread-1')

    const outs = screen.getAllByLabelText('Open in its own window')
    expect(outs).toHaveLength(2)

    fireEvent.click(outs[1]!)
    expect(popOutThread).toHaveBeenLastCalledWith('thread-2')

    fireEvent.click(outs[0]!)
    expect(popOutThread).toHaveBeenLastCalledWith('thread-1')
    expect(popOutThread).toHaveBeenCalledTimes(2)
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
  const slot = (): HTMLElement => screen.getByLabelText('The chat')
  const chatColumn = (): HTMLElement => document.querySelector<HTMLElement>('[data-column="chat"]')!

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

    const card = within(chatColumn())
      .getAllByRole('button')
      .find(one => one.textContent?.includes('look at the footer'))!
    fireEvent.click(card)

    expect(useCrew.getState().openThreadIds).toEqual(['thread-1', 'thread-2'])
    expect(useCrew.getState().openThreadId).toBe('thread-2')
    expect(useCrew.getState().chatColumn).toBe(true)
  })

  it('says beside on a card, now that the feed can stand with a column', () => {
    open(['thread-1'], 'thread-1')
    fireEvent.click(slot())

    const card = within(chatColumn())
      .getAllByRole('button')
      .find(one => one.textContent?.includes('look at the footer'))!
    fireEvent.contextMenu(card)

    expect(screen.getByText('Open beside')).toBeTruthy()
    expect(screen.queryByText('Open')).toBeNull()
  })

  it('leaves no way in once the row is full', () => {
    open(
      Array.from({ length: VIEW_LIMIT }, (_, i) => `row-${i + 1}`),
      'row-1'
    )
    expect(screen.queryByLabelText('The chat')).toBeNull()
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
    expect(screen.queryByText('Open beside')).toBeNull()

    fireEvent.click(screen.getByText('Open'))
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('pops one out without it standing in both places at once', () => {
    open([], null)
    fireEvent.contextMenu(card('look at the footer'))
    fireEvent.click(screen.getByText('Open in its own window'))

    expect(popOutThread).toHaveBeenLastCalledWith('thread-2', undefined)
    expect(useCrew.getState().openThreadIds).toEqual([])
  })
})
