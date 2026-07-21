// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import App from '../src/renderer/src/App'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

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
    threadId: 'thread-1'
  }
]

describe('thread navigation', () => {
  it('opens a completed agent thread without crashing the renderer', () => {
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
          createdBy: 'ALI'
        }
      },
      threadPrompts: {},
      threadDrafts: {},
      queues: {},
      steps: {},
      tokens: {},
      pending: {},
      openThreadId: null
    })

    render(createElement(App))
    fireEvent.click(screen.getByText('I want to follow up with another agent').closest('button')!)

    expect(screen.getByLabelText('Back to chat')).toBeTruthy()
    expect(screen.getByPlaceholderText('Send a message or @ another agent')).toBeTruthy()
    expect(screen.getByText('Claude exited with code 1')).toBeTruthy()
  })
})
