// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep, PooledAgent } from '../src/shared/llm'
import { landed } from './helpers/boot'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
landed()

const AGENT: PooledAgent = {
  id: 'ali/claude',
  label: 'Claude',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const THREAD = 'thread-old'

// What the host hands back for a thread the window has scrolled past. None of
// it is in the window's own events, which is the whole of what this is about.
const readBack: SessionEvent[] = [
  {
    id: 'old-started',
    ts: 1,
    kind: 'thread.started',
    threadId: THREAD,
    agentId: AGENT.id,
    agentLabel: AGENT.label,
    title: '@Claude what is the best way to add usage',
    byName: 'ALI'
  },
  {
    id: 'old-asked',
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: '@Claude what is the best way to add usage',
    mentions: [AGENT.id],
    threadId: THREAD
  },
  {
    id: 'old-start',
    ts: 3,
    kind: 'agent.start',
    promptId: 'prompt-old',
    agentId: AGENT.id,
    agentLabel: AGENT.label,
    promptText: 'what is the best way to add usage',
    byName: 'ALI',
    threadId: THREAD
  },
  {
    id: 'old-end',
    ts: 5,
    kind: 'agent.end',
    promptId: 'prompt-old',
    agentId: AGENT.id,
    agentLabel: AGENT.label,
    ok: true,
    text: 'Here is the plan.',
    threadId: THREAD
  }
]

const STEP: AgentStep = { id: 'step-1', ts: 4, kind: 'tool', status: 'done', name: 'Read', detail: 'pricing.ts' }

// Everything the window really holds: the thread's row, and a chat that has
// moved on a long way since.
const stand = (read: SessionEvent[], steps: Record<string, AgentStep[]>): void => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [AGENT],
    events: [{ id: 'since', ts: 900, kind: 'message', authorId: 'ali', authorName: 'ALI', text: 'since', mentions: [] }],
    readEvents: read,
    readSteps: steps,
    threads: {
      [THREAD]: {
        id: THREAD,
        agentId: AGENT.id,
        agentLabel: AGENT.label,
        title: '@Claude what is the best way to add usage',
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
    openThreadIds: [THREAD],
    openThreadId: THREAD
  })
}

describe('a thread the window has scrolled past', () => {
  afterEach(cleanup)

  it('draws nothing at all from the window alone', () => {
    stand([], {})
    render(createElement(ThreadView, { threadId: THREAD }))
    expect(screen.queryByText('Here is the plan.')).toBeNull()
  })

  it('draws its words and its work off what was read back', () => {
    stand(readBack, { 'prompt-old': [STEP] })
    render(createElement(ThreadView, { threadId: THREAD }))
    expect(screen.getByText('what is the best way to add usage')).toBeTruthy()
    expect(screen.getByText('Here is the plan.')).toBeTruthy()
    expect(screen.getByText('pricing.ts')).toBeTruthy()
  })
})
