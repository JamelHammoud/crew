// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/renderer/src/App'
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
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}
landed()
afterEach(cleanup)

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

const read = (id: string, detail: string): AgentStep => ({
  id,
  ts: 10,
  kind: 'tool',
  status: 'done',
  name: 'Read',
  detail
})

const steps: AgentStep[] = [
  {
    id: 'b0',
    ts: 5,
    kind: 'thinking',
    status: 'done',
    text: 'The keyline set decides how big a circle may be.'
  },
  read('t1', 'src/renderer/src/App.tsx'),
  read('t2', 'design/hero-shot.png'),
  read('t3', 'src/shared/llm.ts'),
  {
    id: 't4',
    ts: 11,
    kind: 'tool',
    status: 'done',
    name: 'Bash',
    detail: 'yarn test tests/icons.test.ts',
    output: 'every mark stands within its own family'
  }
]

const events: SessionEvent[] = [
  {
    id: 'thread-start',
    ts: 1,
    kind: 'thread.started',
    threadId: 'thread-1',
    agentId: agent.id,
    agentLabel: agent.label,
    title: '@Claude 2 look at the icons',
    byName: 'ALI'
  },
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: '@Claude 2 look at the icons',
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
    promptText: 'look at the icons',
    byName: 'ALI',
    threadId: 'thread-1'
  },
  {
    id: 'agent-end',
    ts: 20,
    kind: 'agent.end',
    promptId: 'prompt-1',
    agentId: agent.id,
    agentLabel: agent.label,
    ok: true,
    text: 'Every mark is on the grid.',
    threadId: 'thread-1'
  }
]

const openThread = () => {
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
        title: '@Claude 2 look at the icons',
        createdBy: 'ALI',
        status: 'open',
        mode: 'build'
      }
    },
    threadPrompts: {},
    threadDrafts: {},
    queues: {},
    steps: { 'prompt-1': steps },
    tokens: {},
    pending: {},
    openThreadId: 'thread-1'
  })
  render(createElement(App))
}

const find = (): HTMLInputElement => screen.getByPlaceholderText('Find in thread') as HTMLInputElement

const type = (text: string) => fireEvent.change(find(), { target: { value: text } })

const shown = (): string => document.body.textContent ?? ''

describe('finding something in a thread', () => {
  it('opens on the shortcut and closes on Escape', () => {
    openThread()
    expect(screen.queryByPlaceholderText('Find in thread')).toBeNull()

    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    expect(find()).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Find in thread')).toBeNull()
  })

  it('reaches a path inside a folded run of reads', () => {
    openThread()
    expect(shown()).toContain('Read files')
    expect(shown()).not.toContain('hero-shot.png')

    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    type('hero-shot.png')
    expect(shown()).toContain('hero-shot.png')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(shown()).not.toContain('hero-shot.png')
  })

  it('reaches a thought and what a command printed', () => {
    openThread()
    expect(shown()).toContain('Thought')
    expect(shown()).not.toContain('The keyline set decides')
    expect(shown()).not.toContain('stands within its own family')

    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    type('keyline set')
    expect(shown()).toContain('The keyline set decides')

    type('within its own family')
    expect(shown()).toContain('stands within its own family')
    expect(shown()).not.toContain('The keyline set decides')
  })

  it('leaves the thread as it was once the search is cleared', () => {
    openThread()
    fireEvent.keyDown(window, { key: 'f', metaKey: true })
    type('hero-shot.png')
    expect(shown()).toContain('hero-shot.png')

    type('')
    expect(shown()).toContain('Read files')
    expect(shown()).not.toContain('hero-shot.png')
  })
})
