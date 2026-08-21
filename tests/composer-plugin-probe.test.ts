// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PooledAgent } from '../src/shared/llm'
import { installPlugin, type CrewPlugin } from '../src/shared/plugins'
import { useMessagePlugin } from '../src/renderer/src/state/messagePlugin'
import { useCrew } from '../src/renderer/src/state/store'
import Chat from '../src/renderer/src/views/Chat'
import { MAX_ATTACHMENTS } from '../src/shared/attachments'
import type { PendingAttachment } from '../src/renderer/src/components/images'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const kept = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
    clear: () => kept.clear()
  }
})

const AGENT: PooledAgent = {
  id: 'ali/bubbles',
  label: 'Bubbles',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const plugin = (name: string): CrewPlugin => ({
  ...installPlugin(
    { catalogId: name, name },
    name === 'raylight' ? '00000000-0000-4000-8000-000000000001' : '00000000-0000-4000-8000-000000000002'
  ),
  id: name,
  by: 'ALI',
  ts: 1
})

const open = (plugins: CrewPlugin[], sendChat = vi.fn(), pending: PendingAttachment[] = []) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    place: 'project:/tmp/one',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [AGENT],
    plugins,
    events: [],
    docs: {},
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    chatCommands: [],
    queues: {},
    steps: {},
    tokens: {},
    pending: pending.length ? { chat: pending } : {},
    openThreadId: null,
    docsTarget: null,
    sendChat
  })
  render(createElement(Chat))
  return { composer: screen.getByRole('textbox') as HTMLTextAreaElement, sendChat }
}

const pick = (label: string) => {
  fireEvent.click(screen.getByLabelText('Add to your message'))
  fireEvent.click(screen.getByText(label))
}

describe('putting a plugin on a message', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear()
    useMessagePlugin.setState({ picked: {} })
  })
  afterEach(cleanup)

  it('is not offered with nothing plugged in', () => {
    open([])
    fireEvent.click(screen.getByLabelText('Add to your message'))

    expect(screen.queryByText('Frontpages')).toBeNull()
  })

  it('puts installed plugins directly under the GIF picker', () => {
    open([plugin('frontpages')])
    fireEvent.click(screen.getByLabelText('Add to your message'))
    const gif = screen.getByText('Pick a GIF').closest('button')!
    const frontpages = screen.getByText('Frontpages').closest('button')!
    expect(gif.compareDocumentPosition(frontpages) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps plugins available when the file tray is full', () => {
    const pending = Array.from({ length: MAX_ATTACHMENTS }, (_, index) => ({
      id: `file-${index}`,
      name: `file-${index}.txt`,
      mime: 'text/plain',
      size: 1,
      data: 'eA=='
    }))
    open([plugin('frontpages')], vi.fn(), pending)
    const add = screen.getByLabelText('Add to your message')
    expect(add.hasAttribute('disabled')).toBe(false)
    fireEvent.click(add)
    expect(screen.getByText('Frontpages')).toBeTruthy()
    expect(screen.queryByText('Upload a file')).toBeNull()
  })

  it('lands a chip that names it, and takes it off again', () => {
    open([plugin('raylight')])
    pick('Raylight')

    const row = screen.getByLabelText('Add to your message').parentElement?.parentElement as HTMLElement
    expect(row.textContent).toContain('Raylight')

    fireEvent.click(screen.getByLabelText('Remove Raylight'))
    expect(row.textContent).not.toContain('Raylight')
    expect(useMessagePlugin.getState().picked['chat']).toBeUndefined()
  })

  // It is about the message being written rather than a standing choice, so it
  // goes out beside the words and the box comes back empty of it.
  it('sends it beside the message and does not stand through the send', () => {
    const { composer, sendChat } = open([plugin('raylight'), plugin('frontpages')])
    pick('Frontpages')

    fireEvent.change(composer, { target: { value: 'draw the landing page' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat.mock.calls[0]?.at(-1)).toBe('frontpages')
    expect(useMessagePlugin.getState().picked['chat']).toBeUndefined()
  })

  it('draws nothing for one the crew has taken out since', () => {
    open([plugin('raylight')])
    pick('Raylight')

    act(() => useCrew.setState({ plugins: [] }))

    const row = screen.getByLabelText('Add to your message').parentElement?.parentElement as HTMLElement
    expect(row.textContent).not.toContain('Raylight')
  })
})
