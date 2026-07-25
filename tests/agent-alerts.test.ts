// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/components/TopBar'
import { finishedAlert, reviewCount, type AlertState } from '../src/renderer/src/state/alerts'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { QueuedItem } from '../src/shared/protocol'

const AGENTS = [{ id: 'a1', label: 'Bubbles' }]

const thread = (id: string, extra: Partial<ThreadMeta> = {}): ThreadMeta => ({
  id,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  title: '@Bubbles fix the sync loop',
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build',
  ...extra
})

const ended = (threadId: string | undefined, ok = true): SessionEvent => ({
  id: `e-${threadId}`,
  ts: 1,
  kind: 'agent.end',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  ok,
  threadId
})

const queued = (agentLabel = 'Bubbles'): QueuedItem => ({
  promptId: 'p2',
  authorId: 'jamel',
  authorName: 'Jamel',
  text: 'and then this',
  agentId: 'a1',
  agentLabel
})

const state = (over: Partial<AlertState> = {}): AlertState => ({
  threads: { t1: thread('t1') },
  threadPrompts: {},
  queues: {},
  agents: AGENTS,
  openThreadId: null,
  ...over
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('what is waiting for review', () => {
  it('counts only threads with nothing left running', () => {
    const threads = {
      t1: thread('t1'),
      t2: thread('t2'),
      t3: thread('t3'),
      t4: thread('t4', { status: 'done' }),
      t5: thread('t5', { status: 'archived' })
    }
    const count = reviewCount({ threads, threadPrompts: { t2: 'p1' }, queues: { t3: [queued()] } })
    expect(count).toBe(1)
  })

  it('drops back to nothing once every thread is marked done', () => {
    const threads = { t1: thread('t1', { status: 'done' }), t2: thread('t2', { status: 'done' }) }
    expect(reviewCount({ threads, threadPrompts: {}, queues: {} })).toBe(0)
  })
})

describe('finished alerts', () => {
  it('names the agent and the work, without repeating the mention', () => {
    expect(finishedAlert(ended('t1'), state(), true)).toEqual({
      title: 'Bubbles finished',
      body: 'fix the sync loop',
      threadId: 't1'
    })
  })

  it('reads the agent name back off its id after a rename', () => {
    const alert = finishedAlert(ended('t1'), state({ agents: [{ id: 'a1', label: 'Bubbles 2' }] }), true)
    expect(alert?.title).toBe('Bubbles 2 finished')
  })

  it('says so when a run stopped short', () => {
    expect(finishedAlert(ended('t1', false), state(), true)?.title).toBe('Bubbles stopped')
  })

  it('stays quiet while that thread is on screen', () => {
    expect(finishedAlert(ended('t1'), state({ openThreadId: 't1' }), true)).toBeNull()
  })

  it('still speaks up when the window is in the background', () => {
    expect(finishedAlert(ended('t1'), state({ openThreadId: 't1' }), false)).not.toBeNull()
  })

  it('speaks up when another thread is on screen', () => {
    const threads = { t1: thread('t1'), t2: thread('t2') }
    expect(finishedAlert(ended('t1'), state({ threads, openThreadId: 't2' }), true)).not.toBeNull()
  })

  it('waits when there is more work queued behind the run', () => {
    expect(finishedAlert(ended('t1'), state({ queues: { t1: [queued()] } }), true)).toBeNull()
  })

  it('says nothing about a thread already marked done', () => {
    expect(finishedAlert(ended('t1'), state({ threads: { t1: thread('t1', { status: 'done' }) } }), true)).toBeNull()
  })

  it('ignores everything that is not a run ending', () => {
    const message: SessionEvent = {
      id: 'm1',
      ts: 1,
      kind: 'message',
      authorId: 'jamel',
      authorName: 'Jamel',
      text: 'hello',
      mentions: []
    }
    expect(finishedAlert(message, state(), false)).toBeNull()
  })
})

describe('the tasks button', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )
  })

  it('shows the same number the app badge is given', () => {
    const threads = { t1: thread('t1'), t2: thread('t2'), t3: thread('t3', { status: 'done' }) }
    useCrew.setState({ threads, threadPrompts: {}, queues: {} })
    render(createElement(TopBar, { tab: 'chat', onTab: () => {}, tasksOpen: false, onToggleTasks: () => {} }))

    const count = reviewCount(useCrew.getState())
    expect(count).toBe(2)
    expect(screen.getByRole('button', { name: 'Tasks' }).textContent).toBe(String(count))
  })
})
