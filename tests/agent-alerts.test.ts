// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alertToast } from '../src/renderer/src/components/alertToast'
import Toaster from '../src/renderer/src/components/Toaster'
import TopBar from '../src/renderer/src/components/TopBar'
import { finishedAlert, memberMentionAlert, reviewCount, type AlertState } from '../src/renderer/src/state/alerts'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import { clearToasts } from '../src/renderer/src/state/toast'
import type { AgentAlert } from '../src/shared/alerts'
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
    expect(finishedAlert(ended('t1'), state())).toEqual({
      title: 'Bubbles finished',
      body: 'fix the sync loop',
      threadId: 't1',
      agentId: 'a1',
      stopped: false
    })
  })

  it('reads the agent name back off its id after a rename', () => {
    const alert = finishedAlert(ended('t1'), state({ agents: [{ id: 'a1', label: 'Bubbles 2' }] }))
    expect(alert?.title).toBe('Bubbles 2 finished')
  })

  it('says so when a run stopped short', () => {
    const alert = finishedAlert(ended('t1', false), state())
    expect(alert?.title).toBe('Bubbles stopped')
    expect(alert?.stopped).toBe(true)
  })

  it('stays quiet while that thread is on screen', () => {
    expect(finishedAlert(ended('t1'), state({ openThreadId: 't1' }))).toBeNull()
  })

  it('speaks up when another thread is on screen', () => {
    const threads = { t1: thread('t1'), t2: thread('t2') }
    expect(finishedAlert(ended('t1'), state({ threads, openThreadId: 't2' }))).not.toBeNull()
  })

  it('waits when there is more work queued behind the run', () => {
    expect(finishedAlert(ended('t1'), state({ queues: { t1: [queued()] } }))).toBeNull()
  })

  it('says nothing about a thread already marked done', () => {
    expect(finishedAlert(ended('t1'), state({ threads: { t1: thread('t1', { status: 'done' }) } }))).toBeNull()
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
    expect(finishedAlert(message, state())).toBeNull()
  })
})

describe('member mention alerts', () => {
  const message = (authorId = 'jamel'): SessionEvent => ({
    id: 'm1',
    ts: 1,
    kind: 'message',
    authorId,
    authorName: 'Jamel',
    text: 'Can you look at this @ALI?',
    mentions: [],
    memberMentionRefs: [{ id: 'ali', name: 'ALI' }],
    threadId: 't1'
  })

  it('alerts the named member, and carries who it came from', () => {
    expect(memberMentionAlert(message(), 'ali', null)).toEqual({
      title: 'Jamel mentioned you',
      body: 'Can you look at this @ALI?',
      threadId: 't1',
      from: 'Jamel'
    })
  })

  it('stays quiet inside the thread it was said in, and for your own message', () => {
    expect(memberMentionAlert(message(), 'ali', 't1')).toBeNull()
    expect(memberMentionAlert(message('ali'), 'ali', null)).toBeNull()
  })

  it('still speaks up while another thread is open', () => {
    expect(memberMentionAlert(message(), 'ali', 't2')).not.toBeNull()
  })
})

describe('an alert in the app', () => {
  const finished = (): AgentAlert => finishedAlert(ended('t1'), state())!

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    act(() => clearToasts())
    act(() => {
      vi.advanceTimersByTime(TOAST_OUT_MS + 10)
    })
    vi.useRealTimers()
  })

  it('says the same thing the system banner would, with the face it is about', () => {
    render(createElement(Toaster))
    act(() => alertToast(finished(), () => {}))

    expect(screen.getByText('Bubbles finished')).toBeTruthy()
    expect(screen.getByText('fix the sync loop')).toBeTruthy()
    expect(document.querySelector('.toast-card svg')).toBeTruthy()
  })

  it('opens the thread it is about', () => {
    const opened = vi.fn()
    render(createElement(Toaster))
    act(() => alertToast(finished(), opened))

    fireEvent.click(screen.getByText('Open'))
    expect(opened).toHaveBeenCalledWith('t1')
  })

  it('a run that stopped short is one to notice', () => {
    render(createElement(Toaster))
    act(() => alertToast(finishedAlert(ended('t1', false), state())!, () => {}))
    expect(document.querySelector('[role="alert"]')).toBeTruthy()
  })

  it('one row per thread, rewritten where it stands', () => {
    render(createElement(Toaster))
    act(() => {
      alertToast(finished(), () => {})
      alertToast({ title: 'Jamel mentioned you', body: 'take a look', threadId: 't1', from: 'Jamel' }, () => {})
    })
    expect(document.querySelectorAll('.toast-row').length).toBe(1)
    expect(screen.getByText('Jamel mentioned you')).toBeTruthy()
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
