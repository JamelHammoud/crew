// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/src/App'
import ThreadView from '../src/renderer/src/views/ThreadView'
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
  label: 'Claude',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const PLAN = '## Steps\n\n1. Rename the tabs\n2. Ship it'

const events: SessionEvent[] = [
  {
    id: 'thread-start',
    ts: 1,
    kind: 'thread.started',
    threadId: 'thread-1',
    agentId: agent.id,
    agentLabel: agent.label,
    title: '@Claude rename the tabs',
    byName: 'ALI',
    mode: 'plan'
  },
  {
    id: 'plan-1',
    ts: 2,
    kind: 'thread.plan',
    threadId: 'thread-1',
    text: PLAN,
    agentId: agent.id,
    agentLabel: agent.label
  }
]

const online = {
  connection: 'online' as const,
  selfId: 'ali',
  selfName: 'ALI',
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  agents: [agent],
  threadPrompts: {},
  threadDrafts: {},
  queues: {},
  steps: {},
  tokens: {},
  pending: {},
  openThreadIds: [],
  openThreadId: null
}

describe('plans in the app', () => {
  afterEach(cleanup)

  it('keeps the plan out of the chat and stands it beside the thread once opened', () => {
    useCrew.setState({
      ...online,
      events,
      threads: {
        'thread-1': {
          id: 'thread-1',
          agentId: agent.id,
          agentLabel: agent.label,
          title: '@Claude rename the tabs',
          createdBy: 'ALI',
          status: 'open',
          mode: 'plan',
          plan: PLAN
        }
      }
    })

    render(createElement(App))
    expect(screen.getByText('Planning complete')).toBeTruthy()
    expect(screen.queryByText('Rename the tabs')).toBeNull()
    expect(screen.queryByText('Ship it')).toBeNull()

    fireEvent.click(screen.getByText('Planning complete'))
    expect(screen.getByLabelText('Back to chat')).toBeTruthy()
    expect(screen.getByText('Plan')).toBeTruthy()
    expect(screen.getByText('Ready for review')).toBeTruthy()
    expect(screen.getByText('Implement plan')).toBeTruthy()
    expect(screen.getAllByText('Ship it').length).toBeGreaterThan(0)
  })

  it('fades the plan text only once it is scrolled', () => {
    useCrew.setState({
      ...online,
      events,
      openThreadIds: ['thread-1'],
      openThreadId: 'thread-1',
      threads: {
        'thread-1': {
          id: 'thread-1',
          agentId: agent.id,
          agentLabel: agent.label,
          title: '@Claude rename the tabs',
          createdBy: 'ALI',
          status: 'open',
          mode: 'plan',
          plan: PLAN
        }
      }
    })

    render(createElement(App))
    const scroller = screen.getByText('Ship it').closest('.overflow-y-auto') as HTMLElement
    const panel = scroller.parentElement as HTMLElement
    const fade = panel.querySelector('.bg-gradient-to-b') as HTMLElement
    expect(fade.className).toContain('opacity-0')

    Object.defineProperty(scroller, 'scrollHeight', { value: 600, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true })
    scroller.scrollTop = 120
    fireEvent.scroll(scroller)

    expect(fade.className).toContain('opacity-100')
    expect(panel.querySelector('.bg-gradient-to-t')?.className).toContain('opacity-100')
  })

  it('offers to implement a completed plan below its message in the thread', () => {
    const implementPlan = vi.fn()
    useCrew.setState({
      ...online,
      implementPlan,
      events: [
        events[0],
        {
          id: 'message-1',
          ts: 2,
          kind: 'message',
          authorId: 'ali',
          authorName: 'ALI',
          text: '@Claude rename the tabs',
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
          promptText: 'rename the tabs',
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
          ok: true,
          text: PLAN,
          threadId: 'thread-1',
          ms: 1200
        },
        events[1]
      ],
      threads: {
        'thread-1': {
          id: 'thread-1',
          agentId: agent.id,
          agentLabel: agent.label,
          title: '@Claude rename the tabs',
          createdBy: 'ALI',
          status: 'open',
          mode: 'plan',
          plan: PLAN
        }
      }
    })

    render(createElement(ThreadView, { threadId: 'thread-1' }))
    const action = screen.getByRole('button', { name: 'Implement plan' })
    expect(action.parentElement?.className).toContain('pl-14')

    fireEvent.click(action)
    expect(implementPlan).toHaveBeenCalledWith('thread-1')
  })

  it('offers /plan from the composer, and lifts it out of the box', () => {
    useCrew.setState({ ...online, events: [], threads: {}, chatDraft: '', chatCommands: [] })

    render(createElement(App))
    const composer = screen.getByRole('textbox')
    fireEvent.change(composer, { target: { value: '/' } })

    const command = screen.getByText('/plan')
    fireEvent.click(command)
    expect(useCrew.getState().chatDraft).toBe('')
    expect(useCrew.getState().chatCommands).toEqual(['plan'])
  })
})
