// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import SubagentChips from '../src/renderer/src/components/SubagentChips'
import ThreadCard from '../src/renderer/src/components/ThreadCard'
import {
  buildThread,
  threadState,
  THREAD_STATE_LABELS,
  type SubagentRun
} from '../src/renderer/src/components/thread'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { soundFor } from '../src/renderer/src/media/sounds'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const thread: ThreadMeta = {
  id: 't1',
  agentId: 'a1',
  agentLabel: 'Fable',
  title: 'redraw the rows',
  createdBy: 'ALI',
  status: 'open',
  mode: 'build'
}

const started: SessionEvent = {
  id: 'e1',
  ts: 1,
  kind: 'agent.start',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Fable',
  promptText: 'redraw the rows',
  byName: 'ALI',
  threadId: 't1'
}

const ended = (extra: Partial<Extract<SessionEvent, { kind: 'agent.end' }>>): SessionEvent => ({
  id: 'e2',
  ts: 2,
  kind: 'agent.end',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Fable',
  threadId: 't1',
  ok: false,
  ...extra
})

const stopped = ended({ error: 'Stopped', stopped: true })
const broke = ended({ error: 'The CLI is not installed.' })

const load = (events: SessionEvent[]) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [
      {
        id: 'a1',
        label: 'Fable',
        provider: 'claude',
        ownerId: 'ali',
        ownerName: 'ALI',
        status: 'idle',
        runs: {},
        settings: {},
        fields: []
      }
    ],
    events,
    docs: {},
    threads: { t1: thread },
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    chatCommands: [],
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: 't1',
    docsTarget: null
  })
}

const reds = (): HTMLElement[] =>
  [...document.querySelectorAll('[class*="text-danger"]')] as HTMLElement[]

describe('a run somebody stopped', () => {
  afterEach(cleanup)

  it('is its own standing rather than a failure', () => {
    expect(threadState(thread, [started, stopped], false)).toBe('stopped')
    expect(threadState(thread, [started, broke], false)).toBe('failed')
  })

  it('says Stopped', () => {
    expect(THREAD_STATE_LABELS.stopped).toBe('Stopped')
  })

  it('reads on its card without a word or a mark in danger', () => {
    load([started, stopped])
    render(
      createElement(ThreadCard, {
        thread,
        ts: 1,
        status: { state: threadState(thread, [started, stopped], false), added: 0, removed: 0 },
        onOpen: () => {}
      })
    )
    expect(screen.getByText('Stopped')).toBeTruthy()
    expect(reds()).toHaveLength(0)
  })

  it('still draws a real failure in danger, so the color keeps meaning something', () => {
    load([started, broke])
    render(
      createElement(ThreadCard, {
        thread,
        ts: 1,
        status: { state: threadState(thread, [started, broke], false), added: 0, removed: 0 },
        onOpen: () => {}
      })
    )
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(reds().length).toBeGreaterThan(0)
  })

  it('reads the same in the thread it happened in', () => {
    load([started, stopped])
    render(createElement(ThreadView, { threadId: 't1' }))
    expect(screen.getAllByText('Stopped').length).toBeGreaterThan(0)
    expect(screen.queryByText('Failed')).toBeNull()
    expect(reds()).toHaveLength(0)
  })

  // Whatever a killed CLI says on its way out, the thread says the one thing
  // that is true of every way it can come back.
  it('carries the word onto the line in the thread', () => {
    const items = buildThread([started, ended({ error: 'exited with code 143', stopped: true })], {}, 'ali')
    const reply = items.find(item => item.kind === 'reply')
    expect(reply?.stopped).toBe(true)
  })

  // A stop takes the helpers with it, so the chips are where one press would
  // otherwise paint a whole row red.
  it('leaves the helpers it took with it saying what happened', () => {
    const run = (threadId: string, extra: Partial<SubagentRun>): SubagentRun => ({
      threadId,
      name: 'Scout',
      subject: 'reading the schema',
      agentId: 'a1',
      ok: false,
      ...extra
    })
    load([])
    render(
      createElement(SubagentChips, {
        runs: [run('c1', { stopped: true })],
        threadId: 't1'
      })
    )
    expect(screen.getByText('Stopped')).toBeTruthy()
    expect(reds()).toHaveLength(0)

    cleanup()
    load([])
    render(createElement(SubagentChips, { runs: [run('c2', {})], threadId: 't1' }))
    expect(screen.queryByText('Stopped')).toBeNull()
    expect(reds().length).toBeGreaterThan(0)
  })

  it('makes no sound, since whoever pressed it knows', () => {
    const state = { threads: { t1: thread }, threadPrompts: {}, queues: {} }
    expect(soundFor(stopped, 'ali', state)).toBeNull()
    expect(soundFor(broke, 'ali', state)).toBe('failed')
  })
})
