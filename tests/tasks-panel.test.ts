// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TasksPanel from '../src/renderer/src/components/TasksPanel'
import { reviewCount } from '../src/renderer/src/state/alerts'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'

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

const started = (threadId: string): SessionEvent => ({
  id: `s-${threadId}`,
  ts: 1,
  kind: 'thread.started',
  threadId,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  title: '@Bubbles fix the sync loop',
  byName: 'Jamel'
})

const panel = () =>
  render(createElement(TasksPanel, { open: true, onClose: () => {}, onOpenThread: () => {} }))

const needsReviewShown = (): number => {
  const heading = screen.getByText('Needs review').closest('h3')
  return Number(heading?.textContent?.replace('Needs review', '').trim() || 0)
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the needs review list', () => {
  it('lists every open thread, not the ones the trimmed log still remembers starting', () => {
    const threads = { t1: thread('t1'), t2: thread('t2'), t3: thread('t3'), t4: thread('t4') }
    useCrew.setState({ threads, threadPrompts: {}, queues: {}, steps: {}, todos: [], events: [started('t4')] })
    panel()

    expect(needsReviewShown()).toBe(4)
  })

  it('shows the number the tasks badge shows', () => {
    const threads = {
      t1: thread('t1'),
      t2: thread('t2', { status: 'done' }),
      t3: thread('t3', { status: 'archived' }),
      t4: thread('t4')
    }
    useCrew.setState({ threads, threadPrompts: {}, queues: {}, steps: {}, todos: [], events: [] })
    panel()

    expect(needsReviewShown()).toBe(reviewCount(useCrew.getState()))
    expect(needsReviewShown()).toBe(2)
  })

  it('leaves out a thread that is still running or has work queued behind it', () => {
    const threads = { t1: thread('t1'), t2: thread('t2'), t3: thread('t3') }
    useCrew.setState({
      threads,
      threadPrompts: { t2: 'p1' },
      queues: {
        t3: [{ promptId: 'p2', authorId: 'jamel', authorName: 'Jamel', text: 'and then this', agentId: 'a1', agentLabel: 'Bubbles' }]
      },
      steps: {},
      todos: [],
      events: []
    })
    panel()

    expect(needsReviewShown()).toBe(1)
    expect(needsReviewShown()).toBe(reviewCount(useCrew.getState()))
  })
})
