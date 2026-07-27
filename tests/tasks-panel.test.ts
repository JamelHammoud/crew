// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TasksPanel from '../src/renderer/src/components/TasksPanel'
import { reviewCount } from '../src/renderer/src/state/alerts'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { SessionEvent, Todo } from '../src/shared/events'

Element.prototype.getAnimations ??= () => []

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

const said = (threadId: string, ts: number): SessionEvent => ({
  id: `m-${threadId}-${ts}`,
  ts,
  kind: 'message',
  authorId: 'jamel',
  authorName: 'Jamel',
  text: 'one more thing',
  mentions: [],
  threadId
})

const todo = (id: string, text: string, extra: Partial<Todo> = {}): Todo => ({
  id,
  text,
  createdBy: 'Jamel',
  ts: 1,
  checked: true,
  ...extra
})

const day = (ts: number): number => Date.now() - ts * 86_400_000

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

describe('the done list', () => {
  const openDone = (): HTMLElement => {
    const heading = screen.getByRole('button', { name: /Done/ })
    fireEvent.click(heading)
    return heading.closest('section') as HTMLElement
  }

  it('puts the task that spoke last at the top, whether it is a thread or a todo', () => {
    const threads = {
      t1: thread('t1', { status: 'done', title: '@Bubbles fix the sync loop' }),
      t2: thread('t2', { status: 'done', title: '@Bubbles draw the icon' })
    }
    useCrew.setState({
      threads,
      threadPrompts: {},
      queues: {},
      steps: {},
      todos: [todo('d1', 'water the plants', { checkedTs: day(1) })],
      events: [started('t1'), said('t1', day(3)), started('t2'), said('t2', day(0))]
    })
    panel()
    const text = openDone().textContent ?? ''

    expect(text.indexOf('draw the icon')).toBeLessThan(text.indexOf('water the plants'))
    expect(text.indexOf('water the plants')).toBeLessThan(text.indexOf('fix the sync loop'))
  })

  it('says when each one last moved', () => {
    useCrew.setState({
      threads: { t1: thread('t1', { status: 'done' }) },
      threadPrompts: {},
      queues: {},
      steps: {},
      todos: [todo('d1', 'water the plants', { checkedTs: day(1) })],
      events: [started('t1'), said('t1', day(0))]
    })
    panel()
    const text = openDone().textContent ?? ''

    expect(text).toContain('Today')
    expect(text).toContain('Yesterday')
  })

  it('dates a todo from when it was checked, not from when it was written', () => {
    useCrew.setState({
      threads: {},
      threadPrompts: {},
      queues: {},
      steps: {},
      todos: [todo('d1', 'water the plants', { ts: day(9), checkedTs: day(0) })],
      events: []
    })
    panel()

    expect(openDone().textContent).toContain('Today')
  })
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
