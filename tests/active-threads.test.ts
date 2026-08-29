import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { activeThreads } from '../src/shared/threads'

let n = 0

const started = (threadId: string, title: string, extra: Partial<SessionEvent> = {}): SessionEvent =>
  ({
    id: `e${(n += 1)}`,
    ts: n,
    kind: 'thread.started',
    threadId,
    agentId: 'a',
    agentLabel: 'Bubbles',
    title,
    byName: 'Jamel',
    ...extra
  }) as SessionEvent

const ran = (threadId: string): SessionEvent =>
  ({
    id: `e${(n += 1)}`,
    ts: n,
    kind: 'agent.start',
    promptId: `p${n}`,
    agentId: 'a',
    agentLabel: 'Bubbles',
    promptText: 'go',
    byName: 'Jamel',
    threadId
  }) as SessionEvent

const said = (threadId: string): SessionEvent =>
  ({
    id: `e${(n += 1)}`,
    ts: n,
    kind: 'message.route',
    messageId: `m${n}`,
    threadId,
    promptId: `p${n}`,
    mode: 'queued'
  }) as SessionEvent

const stepped = (threadId: string): SessionEvent =>
  ({
    id: `e${(n += 1)}`,
    ts: n,
    kind: 'agent.step',
    promptId: `p${n}`,
    agentId: 'a',
    agentLabel: 'Bubbles',
    step: { kind: 'text', text: 'working' },
    threadId
  }) as SessionEvent

const asked = (threadId: string, promptId: string, text: string): SessionEvent =>
  ({
    id: `e${(n += 1)}`,
    ts: n,
    kind: 'agent.start',
    promptId,
    agentId: 'a',
    agentLabel: 'Bubbles',
    promptText: text,
    byName: 'Jamel',
    threadId
  }) as SessionEvent

const answered = (threadId: string, promptId: string, text: string): SessionEvent =>
  ({
    id: `e${(n += 1)}`,
    ts: n,
    kind: 'agent.end',
    promptId,
    agentId: 'a',
    agentLabel: 'Bubbles',
    ok: true,
    text,
    threadId
  }) as SessionEvent

const none = () => false

describe('the threads a place is showing', () => {
  it('holds the ones that are open, newest first', () => {
    const list = activeThreads([started('a', 'First'), started('b', 'Second')], none)
    expect(list.map(thread => thread.title)).toEqual(['Second', 'First'])
  })

  it('puts the one something last happened in at the top', () => {
    const events = [started('a', 'Older'), started('b', 'Newer'), ran('a')]
    expect(activeThreads(events, none).map(thread => thread.title)).toEqual(['Older', 'Newer'])
  })

  it('counts a message landing in a thread as something happening in it', () => {
    const events = [started('a', 'Older'), started('b', 'Newer'), said('a')]
    expect(activeThreads(events, none).map(thread => thread.title)).toEqual(['Older', 'Newer'])
  })

  it('leaves the order alone while a run goes on saying what it is doing', () => {
    const events = [started('a', 'Older'), ran('a'), started('b', 'Newer'), stepped('a')]
    expect(activeThreads(events, none).map(thread => thread.title)).toEqual(['Newer', 'Older'])
  })

  it('keeps the one worked on last above the ones it was started before', () => {
    const events = [started('a', 'First'), started('b', 'Second'), started('c', 'Third'), ran('b'), ran('a')]
    expect(activeThreads(events, none).map(thread => thread.title)).toEqual(['First', 'Second', 'Third'])
  })

  it('puts the one worked on last at the head of a long list', () => {
    const events = [...Array.from({ length: 20 }, (_, i) => started(`t${i}`, `Thread ${i}`)), ran('t0')]
    expect(activeThreads(events, none)[0]?.id).toBe('t0')
  })

  it('leaves the agent name out and capitalizes the first letter', () => {
    const list = activeThreads([started('a', '@Bubbles draw the rail'), started('b', 'check the sync @Bubbles')], none)
    expect(list.map(thread => thread.title)).toEqual(['Check the sync', 'Draw the rail'])
  })

  it('gives a mention-only thread a name', () => {
    expect(activeThreads([started('a', '@Bubbles')], none)[0]?.title).toBe('Untitled')
  })

  it('keeps the whole opening message as its preview', () => {
    const opening = 'Draw the footer with the whole opening message, including the details that do not fit in the row'
    const events = [
      started('a', 'Draw the footer…'),
      asked('a', 'p1', opening),
      answered('a', 'p1', 'The footer is ready'),
      asked('a', 'p2', 'Make the links quieter'),
      answered('a', 'p2', 'The links are quieter')
    ]

    expect(activeThreads(events, none)[0]?.preview).toBe(opening)
  })

  it('leaves out a thread somebody has finished or put away', () => {
    const events: SessionEvent[] = [
      started('a', 'Done with'),
      started('b', 'Still going'),
      { id: 'x', ts: 9, kind: 'thread.status', threadId: 'a', status: 'done', byName: 'Jamel' } as SessionEvent
    ]
    expect(activeThreads(events, none).map(thread => thread.id)).toEqual(['b'])
  })

  it('takes a thread back off the list when it is archived', () => {
    const events: SessionEvent[] = [
      started('a', 'Gone'),
      { id: 'x', ts: 9, kind: 'thread.archived', threadId: 'a', byName: 'Jamel' } as SessionEvent
    ]
    expect(activeThreads(events, none)).toEqual([])
  })

  it('leaves out a helper and a question asked on the side', () => {
    const events = [
      started('a', 'Mine'),
      started('h', 'A helper', { parentThreadId: 'a' }),
      started('q', 'An aside', { aside: 'a' })
    ]
    expect(activeThreads(events, none).map(thread => thread.id)).toEqual(['a'])
  })

  it('says which of them has an agent working right now', () => {
    const list = activeThreads([started('a', 'Working'), started('b', 'Idle')], id => id === 'a')
    expect(list.find(thread => thread.id === 'a')?.working).toBe(true)
    expect(list.find(thread => thread.id === 'b')?.working).toBe(false)
  })

  it('holds every thread that is open, however many there are', () => {
    const events = Array.from({ length: 24 }, (_, i) => started(`t${i}`, `Thread ${i}`))
    expect(activeThreads(events, none)).toHaveLength(24)
  })
})
