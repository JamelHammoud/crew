// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Chat from '../src/renderer/src/views/Chat'
import { changedIn, runChanged } from '../src/renderer/src/components/threadChanged'
import { liveLine } from '../src/renderer/src/components/threadLive'
import { buildFeed, sameEntry, sameStatus, type ThreadStatus } from '../src/renderer/src/components/feed/feedItems'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep, PooledAgent } from '../src/shared/llm'
import { landed } from './helpers/boot'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []
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

const thread = (id: string, extra: Partial<ThreadMeta> = {}): ThreadMeta => ({
  id,
  agentId: agent.id,
  agentLabel: agent.label,
  title: '@Claude redraw the rows',
  createdBy: 'ALI',
  status: 'open',
  mode: 'build',
  ...extra
})

const started = (id: string, promptId: string, ts = 1): SessionEvent => ({
  id: `start-${promptId}`,
  ts,
  kind: 'agent.start',
  promptId,
  agentId: agent.id,
  agentLabel: agent.label,
  promptText: 'redraw the rows',
  byName: 'ALI',
  threadId: id
})

const opened = (id: string, ts = 0): SessionEvent => ({
  id: `open-${id}`,
  ts,
  kind: 'thread.started',
  threadId: id,
  agentId: agent.id,
  agentLabel: agent.label,
  title: '@Claude redraw the rows',
  byName: 'ALI'
})

const ended = (
  id: string,
  promptId: string,
  extra: Partial<Extract<SessionEvent, { kind: 'agent.end' }>> = {}
): SessionEvent => ({
  id: `end-${promptId}`,
  ts: 9,
  kind: 'agent.end',
  promptId,
  agentId: agent.id,
  agentLabel: agent.label,
  threadId: id,
  ok: true,
  ...extra
})

const step = (extra: Partial<AgentStep>): AgentStep => ({
  id: 's1',
  ts: 2,
  kind: 'tool',
  status: 'running',
  ...extra
})

const edited = (path: string, added: number, removed: number): AgentStep =>
  step({ id: `edit-${path}`, kind: 'tool', status: 'done', name: 'Edit', files: [{ path, added, removed, diff: '' }] })

const base = {
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
  costs: {},
  pending: {},
  openThreadIds: [],
  openThreadId: null,
  docsTarget: null
}

const stand = (state: Record<string, unknown>) => {
  useCrew.setState({ ...base, ...state })
  render(createElement(Chat))
}

describe('what a run is doing reads on the card in the feed', () => {
  afterEach(cleanup)

  it('says the tool the run is holding rather than a word for the kind of work', () => {
    stand({
      events: [opened('t1'), started('t1', 'p1')],
      threads: { t1: thread('t1') },
      threadPrompts: { t1: 'p1' },
      steps: { p1: [step({ name: 'Read', detail: 'src/renderer/src/components/FeedCard.tsx' })] }
    })
    expect(screen.getByText('Reading')).toBeTruthy()
    expect(screen.queryByText('src/renderer/src/components/FeedCard.tsx')).toBeNull()
  })

  it('says Thinking between one tool and the next', () => {
    stand({
      events: [opened('t1'), started('t1', 'p1')],
      threads: { t1: thread('t1') },
      threadPrompts: { t1: 'p1' },
      steps: { p1: [step({ kind: 'thinking', status: 'running', text: 'The band is heavier than the row it sits under.' })] }
    })
    expect(screen.getByText('Thinking')).toBeTruthy()
    expect(screen.queryByText('The band is heavier than the row it sits under.')).toBeNull()
  })

  it('counts what the run has changed so far, before anybody opens it', () => {
    stand({
      events: [opened('t1'), started('t1', 'p1')],
      threads: { t1: thread('t1') },
      threadPrompts: { t1: 'p1' },
      steps: {
        p1: [edited('a.ts', 40, 6), edited('b.ts', 12, 1), step({ name: 'Read', detail: 'c.ts' })]
      }
    })
    expect(screen.getByText('+52')).toBeTruthy()
    expect(screen.getByText('−7')).toBeTruthy()
  })

  it('keeps the counts once the run is done, and stops counting the seconds', () => {
    stand({
      events: [
        opened('t1'),
        started('t1', 'p1'),
        ended('t1', 'p1', { text: 'Redrew the rows and pinned the band.', ms: 65_000, tokens: 4200 })
      ],
      threads: { t1: thread('t1') },
      steps: { p1: [edited('a.ts', 9, 2)] }
    })
    expect(screen.getByText('Ready for review')).toBeTruthy()
    expect(screen.getByText('+9')).toBeTruthy()
    expect(screen.queryByText('1m 5s')).toBeNull()
  })

  it('reads the whole of what somebody wrote rather than the line the title was cut to', () => {
    const long = 'Redraw the thread card\n\nIt is one of the older things here, so make it belong.'
    stand({
      events: [
        opened('t1'),
        { id: 'm1', ts: 1, kind: 'message', threadId: 't1', authorId: 'ali', authorName: 'ALI', text: `@Claude ${long}` },
        started('t1', 'p1'),
        ended('t1', 'p1', { text: 'Done.' })
      ],
      threads: { t1: thread('t1', { title: '@Claude Redraw the thread card It is one of the older…' }) }
    })
    const written = screen.getByText(/older things here/)
    expect(written.textContent).toContain('It is one of the older things here, so make it belong.')
    expect(written.textContent).toContain('\n\n')
  })

  it('spends no row on whose machine it ran, since the agent it names already says so', () => {
    stand({
      events: [opened('t1'), started('t1', 'p1'), ended('t1', 'p1', { text: 'Done.' })],
      threads: { t1: thread('t1') }
    })
    expect(screen.queryByText("ALI's PC")).toBeNull()
  })
})

describe('what a card counts', () => {
  const threads = { t1: thread('t1'), t2: thread('t2', { parentThreadId: 't1' }) }

  it("takes in the helpers a thread sent out, because a helper's edits are the thread's", () => {
    const events = [opened('t1'), started('t1', 'p1'), opened('t2'), started('t2', 'p2')]
    const steps = { p1: [edited('a.ts', 10, 1)], p2: [edited('b.ts', 5, 4)] }
    expect(changedIn(['t1'], events, steps, threads).get('t1')).toEqual({ added: 15, removed: 5 })
  })

  it('settles on a parent named in a circle rather than walking forever', () => {
    const circle = { t1: thread('t1', { parentThreadId: 't2' }), t2: thread('t2', { parentThreadId: 't1' }) }
    const events = [started('t1', 'p1'), started('t2', 'p2')]
    const steps = { p1: [edited('a.ts', 1, 0)], p2: [edited('b.ts', 2, 0)] }
    expect(changedIn(['t1'], events, steps, circle).get('t1')).toEqual({ added: 3, removed: 0 })
  })

  it('answers the same run off the cache rather than counting it again', () => {
    const steps = [edited('a.ts', 3, 1)]
    expect(runChanged(steps)).toBe(runChanged(steps))
  })
})

describe('the line a live step reads as', () => {
  it('wears the tool it is running', () => {
    const line = liveLine(step({ name: 'Read', detail: 'a.ts' }))
    expect(line.label).toBe('Reading')
    expect(line.icon).toBeTruthy()
  })

  it('reads a finished tool as the model thinking, the way the foot of a thread does', () => {
    const line = liveLine(step({ name: 'Read', status: 'done', detail: 'a.ts' }))
    expect(line.label).toBe('Thinking')
    expect(line.icon).toBeUndefined()
  })

  it('is Starting before a run has taken a step', () => {
    expect(liveLine(undefined).label).toBe('Starting')
  })

  it('says Writing while the reply is arriving', () => {
    expect(liveLine(step({ kind: 'text', status: 'running', text: 'Here is what I did.' })).label).toBe('Writing')
  })
})

describe('a card is drawn again only when it reads differently', () => {
  const one: ThreadStatus = { state: 'working', added: 0, removed: 0 }

  it('names every field, so nothing quietly stops updating', () => {
    const fields: Array<Partial<ThreadStatus>> = [
      { state: 'ready' },
      { step: step({}) },
      { startedAt: 5 },
      { added: 5 },
      { removed: 5 }
    ]
    expect(sameStatus(one, { ...one })).toBe(true)
    for (const field of fields) expect(sameStatus(one, { ...one, ...field })).toBe(false)
  })
})
