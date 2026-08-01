import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { activeThreads, THREAD_LIMIT } from '../src/shared/threads'

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

const none = () => false

describe('the threads a place is showing', () => {
  it('holds the ones that are open, newest first', () => {
    const list = activeThreads([started('a', 'First'), started('b', 'Second')], none)
    expect(list.map(thread => thread.title)).toEqual(['Second', 'First'])
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

  it('holds a handful rather than every thread a long project ever had', () => {
    const events = Array.from({ length: THREAD_LIMIT + 5 }, (_, i) => started(`t${i}`, `Thread ${i}`))
    expect(activeThreads(events, none)).toHaveLength(THREAD_LIMIT)
  })
})
