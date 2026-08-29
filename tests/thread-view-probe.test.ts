// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/src/App'
import { THREAD_STATE_LABELS } from '../src/renderer/src/components/thread'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'
import { landed } from './helpers/boot'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
landed()

const agent: PooledAgent = {
  id: 'ali/claude',
  label: 'Claude 2',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const events: SessionEvent[] = [
  {
    id: 'thread-start',
    ts: 1,
    kind: 'thread.started',
    threadId: 'thread-1',
    agentId: agent.id,
    agentLabel: agent.label,
    title: '@Claude 2 I want to follow up with another agent',
    byName: 'ALI'
  },
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: '@Claude 2 I want to follow up with another agent',
    mentions: [agent.id],
    threadId: 'thread-1'
  },
  {
    id: 'agent-start',
    ts: 3,
    kind: 'agent.start',
    promptId: 'prompt-1',
    agentId: agent.id,
    agentLabel: agent.label,
    promptText: 'I want to follow up with another agent',
    byName: 'ALI',
    threadId: 'thread-1'
  },
  {
    id: 'agent-end',
    ts: 4,
    kind: 'agent.end',
    promptId: 'prompt-1',
    agentId: agent.id,
    agentLabel: agent.label,
    ok: false,
    error: 'Claude exited with code 1',
    threadId: 'thread-1',
    ms: 1200
  }
]

describe('thread navigation', () => {
  it('opens a completed agent thread without crashing the renderer', () => {
    const retryThread = vi.fn()
    useCrew.setState({
      connection: 'online',
      selfId: 'ali',
      selfName: 'ALI',
      members: [{ id: 'ali', name: 'ALI', connected: true }],
      agents: [agent],
      events,
      threads: {
        'thread-1': {
          id: 'thread-1',
          agentId: agent.id,
          agentLabel: agent.label,
          title: '@Claude 2 I want to follow up with another agent',
          createdBy: 'ALI',
          status: 'open',
          mode: 'build'
        }
      },
      threadPrompts: {},
      threadDrafts: {},
      queues: {},
      steps: {},
      tokens: {},
      pending: {},
      openThreadId: null,
      retryThread
    })

    render(createElement(App))
    const feedCard = document.querySelector<HTMLElement>('[data-thread="thread-1"]')!
    fireEvent.click(within(feedCard).getByRole('button', { name: THREAD_STATE_LABELS.failed }))

    expect(screen.getByLabelText('Back to chat')).toBeTruthy()
    expect(screen.getByPlaceholderText('Send a message or @ someone')).toBeTruthy()
    expect(screen.getByText('Claude exited with code 1')).toBeTruthy()
    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(retry.compareDocumentPosition(screen.getByText('1s')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(retry)
    expect(retryThread).toHaveBeenCalledWith('thread-1')

    fireEvent.click(screen.getAllByLabelText('Reply').at(-1)!)
    expect(screen.getByText('Replying to Claude 2')).toBeTruthy()
    expect(screen.getAllByText('Claude exited with code 1')).toHaveLength(2)

    const card = screen.getByText('Replying to Claude 2').closest('div')!
    const back = screen.getByLabelText('Back to chat')
    expect(card.contains(back)).toBe(false)
    expect(card.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Cancel reply'))
    expect(screen.queryByText('Replying to Claude 2')).toBeNull()
  })
})
