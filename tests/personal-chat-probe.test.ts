import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PersonalChatWindow from '../src/renderer/src/views/PersonalChatWindow'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
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
  window.crew = { listFiles: async () => [] } as unknown as CrewBridge
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

afterEach(cleanup)

describe('a personal chat window', () => {
  it('starts blank with the shared composer and a history control', () => {
    render(createElement(PersonalChatWindow))

    expect(screen.getByPlaceholderText('Message')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chat history' })).toBeTruthy()
    expect(screen.queryByText('Ask Crew')).toBeNull()
  })

  it('searches saved chats and opens one without the thread composer header', () => {
    const first = thread('first', 'Alpha question', 1)
    const second = thread('second', 'Beta answer', 2)
    useCrew.setState({ threads: { first, second }, events: [started(first), started(second)] })
    render(createElement(PersonalChatWindow))

    fireEvent.click(screen.getByRole('button', { name: 'Chat history' }))
    fireEvent.change(screen.getByPlaceholderText('Search chats'), { target: { value: 'beta' } })

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

    fireEvent.click(screen.getByRole('button', { name: 'Chat history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename Old name' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Chat name' }), { target: { value: 'New name' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Chat name' }), { key: 'Enter' })
    expect(renameThread).toHaveBeenCalledWith('one', 'New name')

    fireEvent.click(screen.getByRole('button', { name: 'Delete Old name' }))
    expect(deleteThread).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Old name' }))
    expect(deleteThread).toHaveBeenCalledWith('one')
  })
})
