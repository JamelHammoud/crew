import { describe, expect, it } from 'vitest'
import { buildThread, eventsOfThread } from '../src/renderer/src/components/thread'
import type { SessionEvent } from '../src/shared/events'

const PARENT = 'parent-thread'
const CHILD = 'child-thread'

const spawned = (ts: number, threadId: string, subject: string): SessionEvent => ({
  id: `started-${threadId}`,
  ts,
  kind: 'subagent.started',
  threadId,
  parentThreadId: PARENT,
  parentPromptId: 'p1',
  name: 'Scout',
  subject,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  byName: 'Bubbles'
})

const returned = (ts: number, threadId: string, ok: boolean, ms: number): SessionEvent => ({
  id: `ended-${threadId}`,
  ts,
  kind: 'subagent.ended',
  threadId,
  parentThreadId: PARENT,
  ok,
  ms
})

const said = (ts: number, threadId: string, text: string): SessionEvent => ({
  id: `m-${ts}`,
  ts,
  kind: 'message',
  authorId: 'sam',
  authorName: 'Sam',
  text,
  mentions: [],
  threadId
})

const chips = (events: SessionEvent[], threadId: string) =>
  buildThread(eventsOfThread(events, threadId), {}, 'sam').filter(item => item.kind === 'subagent')

describe('where a helper chip lands', () => {
  it('lands in the thread that sent it and not in the helper itself', () => {
    const events = [said(1, PARENT, 'go'), spawned(2, CHILD, 'reading the schema'), said(3, CHILD, 'the task')]

    const parent = chips(events, PARENT)
    expect(parent).toHaveLength(1)
    expect(parent[0].runs?.[0].threadId).toBe(CHILD)
    expect(parent[0].runs?.[0].subject).toBe('reading the schema')

    expect(chips(events, CHILD)).toHaveLength(0)
  })

  it('folds the end onto the chip that stands where it started', () => {
    const events = [spawned(2, CHILD, 'reading the schema'), returned(9, CHILD, true, 1200)]

    const [chip] = chips(events, PARENT)
    expect(chip.runs?.[0].ok).toBe(true)
    expect(chip.runs?.[0].ms).toBe(1200)
    expect(chips(events, PARENT)).toHaveLength(1)
  })

  it('folds a breath of helpers into one row', () => {
    const events = [
      spawned(2, 'one', 'the schema'),
      spawned(3, 'two', 'the tests'),
      spawned(4, 'three', 'the docs')
    ].map((event, i) => ({ ...event, id: `started-${i}` }))

    const rows = chips(events, PARENT)
    expect(rows).toHaveLength(1)
    expect(rows[0].runs).toHaveLength(3)
  })

  it('leaves every other event where it was', () => {
    const events = [said(1, PARENT, 'mine'), said(2, CHILD, 'theirs')]
    expect(eventsOfThread(events, PARENT).map(e => e.id)).toEqual(['m-1'])
    expect(eventsOfThread(events, CHILD).map(e => e.id)).toEqual(['m-2'])
  })
})

const ran = (ts: number, threadId: string): SessionEvent => ({
  id: `start-${ts}`,
  ts,
  kind: 'agent.start',
  promptId: 'p9',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  promptText: 'do it',
  byName: 'Bubbles',
  threadId
})

const answered = (ts: number, threadId: string, text: string): SessionEvent => ({
  id: `end-${ts}`,
  ts,
  kind: 'agent.end',
  promptId: 'p9',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  ok: true,
  text,
  threadId
})

const agents = [{ id: 'a1', label: 'Bubbles' }]

describe('who a helper thread reads under', () => {
  const events = [ran(1, CHILD), answered(2, CHILD, 'here it is')]
  const steps = {
    p9: [{ id: 's1', ts: 1, kind: 'thinking' as const, status: 'done' as const, text: 'weighing it' }]
  }

  it('stands under the helper rather than the machine that ran it', () => {
    const items = buildThread(eventsOfThread(events, CHILD), steps, 'sam', agents, { name: 'Copy', seed: CHILD })
    expect(items.map(item => item.author)).toEqual(['Copy', 'Copy'])
    expect(items.every(item => item.helperSeed === CHILD)).toBe(true)
  })

  it('carries no agent id, so nothing looks the helper up as one', () => {
    const items = buildThread(eventsOfThread(events, CHILD), steps, 'sam', agents, { name: 'Copy', seed: CHILD })
    expect(items.every(item => item.authorId === undefined)).toBe(true)
  })

  it('leaves an ordinary thread standing under its agent', () => {
    const items = buildThread(eventsOfThread(events, CHILD), steps, 'sam', agents)
    expect(items.map(item => item.author)).toEqual(['Bubbles', 'Bubbles'])
    expect(items.every(item => item.helperSeed === undefined)).toBe(true)
    expect(items.every(item => item.authorId === 'a1')).toBe(true)
  })

  it('leaves what a person typed into it as theirs', () => {
    const withSteer = [...events, said(3, CHILD, 'try again')]
    const items = buildThread(eventsOfThread(withSteer, CHILD), steps, 'sam', agents, { name: 'Copy', seed: CHILD })
    const message = items.find(item => item.kind === 'message')
    expect(message?.author).toBe('Sam')
    expect(message?.helperSeed).toBeUndefined()
  })
})
