import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PersonalChatWindow from '../src/renderer/src/views/PersonalChatWindow'
import { openHref } from '../src/renderer/src/components/fileLinks'
import { useBrowser } from '../src/renderer/src/state/browser'
import { setPref } from '../src/renderer/src/state/prefs'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import { setFullScreen } from '../src/renderer/src/state/windowShape'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const agent: PooledAgent = {
  id: 'jamel/fake',
  label: 'Fake',
  provider: 'fake',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const thread = (id: string, title: string, startedAt: number): ThreadMeta => ({
  id,
  agentId: agent.id,
  agentLabel: agent.label,
  title,
  createdBy: 'Jamel',
  startedAt,
  status: 'open',
  mode: 'build'
})

const started = (one: ThreadMeta): SessionEvent => ({
  id: `${one.id}-started`,
  ts: one.startedAt ?? 1,
  kind: 'thread.started',
  threadId: one.id,
  agentId: one.agentId,
  agentLabel: one.agentLabel,
  title: one.title,
  byName: 'Jamel'
})

const renameThread = vi.fn()
const deleteThread = vi.fn()

beforeEach(() => {
  renameThread.mockClear()
  deleteThread.mockClear()
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value)
  } satisfies Storage)
  window.crew = { listFiles: async () => [], warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  setFullScreen(false)
  setPref('glassSidebar', true)
  useCrew.setState({
    connection: 'online',
    place: 'personal',
    selfId: 'jamel',
    selfName: 'Jamel',
    agents: [agent],
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    events: [],
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    threadCommands: {},
    queues: {},
    steps: {},
    tokens: {},
    costs: {},
    activePrompts: {},
    pending: {},
    renameThread,
    deleteThread
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('a personal chat window', () => {
  it('starts blank with the shared composer and its chat list beside it', () => {
    render(createElement(PersonalChatWindow))

    expect(screen.getByPlaceholderText('Message')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Message'))
    expect(document.querySelector('[data-personal-history]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New chat' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Search chats' })).toBeTruthy()
    expect(screen.queryByText('Ask Crew')).toBeNull()
  })

  it('keeps the top of the conversation available for moving the window', () => {
    render(createElement(PersonalChatWindow))

    const dragRegion = document.querySelector('[data-personal-chat-drag-region]')
    expect(dragRegion?.classList.contains('app-drag')).toBe(true)
    expect(dragRegion?.classList.contains('inset-x-0')).toBe(true)
    expect(dragRegion?.classList.contains('h-[70px]')).toBe(true)
    expect(dragRegion?.classList.contains('pointer-events-none')).toBe(true)
    expect(document.querySelector('[data-personal-chat-panel-toggle]')?.classList.contains('z-40')).toBe(true)
  })

  it('follows the glass sidebar setting', () => {
    render(createElement(PersonalChatWindow))
    const sidebar = document.querySelector('[data-personal-history]')
    expect(sidebar?.classList.contains('sidebar-pinned')).toBe(true)

    act(() => setPref('glassSidebar', false))
    expect(sidebar?.classList.contains('sidebar-pinned')).toBe(false)
    expect(sidebar?.classList.contains('bg-ink-900')).toBe(true)
  })

  it('shows a top fade after the chat list scrolls', () => {
    render(createElement(PersonalChatWindow))

    const scroller = document.querySelector('[data-personal-history-scroll]') as HTMLDivElement
    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 900 }
    })
    scroller.scrollTop = 80
    fireEvent.scroll(scroller)

    expect(document.querySelector('[data-scroll-fade="top"]')?.classList.contains('opacity-100')).toBe(true)
  })

  it('removes the stoplight reserve in fullscreen', () => {
    render(createElement(PersonalChatWindow))
    const header = document.querySelector('[data-personal-chat-header]')
    expect(header?.classList.contains('mac:pl-[100px]')).toBe(true)

    act(() => setFullScreen(true))
    expect(header?.classList.contains('mac:pl-[100px]')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Hide chat list' }))
    expect(document.querySelector('[data-personal-chat-collapsed-header]')?.classList.contains('mac:pl-[92px]')).toBe(
      false
    )
  })

  it('collapses and restores the chat list without remounting the conversation', () => {
    render(createElement(PersonalChatWindow))
    const composer = screen.getByPlaceholderText('Message')
    const sidebar = document.querySelector('[data-personal-history]') as HTMLElement

    fireEvent.click(screen.getByRole('button', { name: 'Hide chat list' }))
    expect(sidebar.classList.contains('w-0')).toBe(true)
    expect(sidebar.classList.contains('border-transparent')).toBe(true)
    expect(sidebar.className).toContain('transition-[width]')
    expect(sidebar.className).not.toContain('border-color')
    expect(screen.getByRole('button', { name: 'Show chat list' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Message')).toBe(composer)

    fireEvent.click(screen.getByRole('button', { name: 'Show chat list' }))
    expect(sidebar.classList.contains('w-[300px]')).toBe(true)
    expect(sidebar.classList.contains('border-[var(--glass-line)]')).toBe(true)
    expect(sidebar.classList.contains('border-transparent')).toBe(false)
    expect(screen.getByPlaceholderText('Message')).toBe(composer)
  })

  it('searches saved chats and opens one without the thread composer header', () => {
    const first = thread('first', 'Alpha question', 1)
    const second = thread('second', 'Beta answer', 2)
    useCrew.setState({ threads: { first, second }, events: [started(first), started(second)] })
    render(createElement(PersonalChatWindow))

    fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), { target: { value: 'beta' } })

    expect(screen.queryByText('Alpha question')).toBeNull()
    fireEvent.click(screen.getByText('Beta answer'))

    expect(screen.getByPlaceholderText('Send a message or @ someone')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back to chat' })).toBeNull()
  })

  it('renames and confirms deletion from history', () => {
    const one = thread('one', 'Old name', 1)
    useCrew.setState({ threads: { one }, events: [started(one)] })
    render(createElement(PersonalChatWindow))

    fireEvent.click(screen.getByRole('button', { name: 'Rename Old name' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Chat name' }), { target: { value: 'New name' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Chat name' }), { key: 'Enter' })
    expect(renameThread).toHaveBeenCalledWith('one', 'New name')

    fireEvent.click(screen.getByRole('button', { name: 'Delete Old name' }))
    expect(deleteThread).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Old name' }))
    expect(deleteThread).toHaveBeenCalledWith('one')
  })

  it('says what the agent is doing on a chat that is working', () => {
    const one = thread('one', 'Live chat', 1)
    useCrew.setState({
      threads: { one },
      events: [started(one)],
      threadPrompts: { one: 'prompt' },
      steps: { prompt: [{ id: 'step', kind: 'tool', name: 'Bash', status: 'running', ts: 2 }] }
    })
    render(createElement(PersonalChatWindow))

    const row = screen.getByText('Live chat').closest('button') as HTMLButtonElement
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.queryByText('Fake')).toBeNull()
    expect(row.querySelector('[data-activity="running"]')).toBeTruthy()

    act(() => {
      useCrew.setState({ steps: { prompt: [{ id: 'step', kind: 'thinking', status: 'running', ts: 3 }] } })
    })
    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(row.querySelector('[data-activity="thinking"]')).toBeTruthy()

    act(() => useCrew.setState({ threadPrompts: {} }))
    expect(screen.getByText('Fake')).toBeTruthy()
    expect(screen.queryByText('Thinking')).toBeNull()
    expect(row.querySelector('[data-activity="idle"]')).toBeTruthy()
  })

  it('keeps a new chat selected while its start event is arriving', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const sendChat = vi.fn()
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(id)
    useCrew.setState({ sendChat })
    render(createElement(PersonalChatWindow))

    fireEvent.change(screen.getByPlaceholderText('Message'), { target: { value: 'Stay with this chat' } })
    fireEvent.keyDown(screen.getByPlaceholderText('Message'), { key: 'Enter' })
    expect(sendChat).toHaveBeenCalledWith(
      'Stay with this chat',
      undefined,
      undefined,
      undefined,
      [agent.id],
      [],
      undefined,
      id
    )

    const arriving = thread(id, 'Stay with this chat', 3)
    act(() => useCrew.setState({ threads: { [id]: arriving }, events: [started(arriving)] }))

    expect(screen.getByPlaceholderText('Send a message or @ someone')).toBeTruthy()
    expect(screen.queryByPlaceholderText('Message')).toBeNull()
  })

  it('opens a link in the panel it draws of its own', () => {
    render(createElement(PersonalChatWindow))
    expect(document.querySelector('[data-tab]')).toBeNull()

    act(() => openHref('https://example.com/one'))

    expect(useBrowser.getState().open).toBe(true)
    expect(document.querySelector('[data-tab]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New tab' })).toBeTruthy()
  })

  it('stands the way back once the panel is holding something, and not before', () => {
    render(createElement(PersonalChatWindow))
    const away = () => document.querySelector('[aria-label="Show panel"]')?.closest('[aria-hidden="true"]')
    expect(away()).toBeTruthy()

    act(() => openHref('https://example.com/one'))
    act(() => useBrowser.getState().closePanel())
    expect(away()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show panel' }))
    expect(useBrowser.getState().open).toBe(true)
  })

  it('says which chat it is reading, so a page an agent shows opens here', () => {
    const one = thread('one', 'Alpha question', 1)
    useCrew.setState({ threads: { one }, events: [started(one)] })
    render(createElement(PersonalChatWindow))
    expect(useCrew.getState().openThreadIds).toEqual([])

    fireEvent.click(screen.getByText('Alpha question'))
    expect(useCrew.getState().openThreadIds).toEqual(['one'])
    expect(useCrew.getState().openThreadId).toBe('one')

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    expect(useCrew.getState().openThreadIds).toEqual([])
    expect(useCrew.getState().openThreadId).toBeNull()
  })
})
