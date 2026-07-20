import { describe, expect, it } from 'vitest'
import { buildThread } from '../src/renderer/src/components/thread'
import type { SessionEvent } from '../src/shared/events'

const THREAD = 't1'
let seq = 0
const at = () => ++seq

const message = (id: string, text: string): SessionEvent => ({
  id,
  ts: at(),
  kind: 'message',
  authorId: 'sam',
  authorName: 'Sam',
  text,
  mentions: [],
  threadId: THREAD
})

const route = (messageId: string, promptId: string, mode: 'queued' | 'steered'): SessionEvent => ({
  id: `r-${messageId}-${mode}`,
  ts: at(),
  kind: 'message.route',
  messageId,
  threadId: THREAD,
  promptId,
  mode
})

const start = (promptId: string): SessionEvent => ({
  id: `s-${promptId}`,
  ts: at(),
  kind: 'agent.start',
  promptId,
  agentId: 'a1',
  agentLabel: 'Claude',
  promptText: '',
  byName: 'Sam',
  threadId: THREAD
})

const end = (promptId: string): SessionEvent => ({
  id: `e-${promptId}`,
  ts: at(),
  kind: 'agent.end',
  promptId,
  agentId: 'a1',
  agentLabel: 'Claude',
  ok: true,
  text: 'done',
  threadId: THREAD
})

const badgeOf = (events: SessionEvent[], messageId: string) =>
  buildThread(events, {}, 'sam').find(item => item.key === messageId)?.route

describe('message route badges', () => {
  it('marks a message queued until its own run starts', () => {
    const events = [message('m1', 'later'), route('m1', 'p1', 'queued')]
    expect(badgeOf(events, 'm1')).toBe('queued')
    expect(badgeOf([...events, start('p1')], 'm1')).toBeUndefined()
  })

  it('marks a steered message while the run it joined is live, then as steered', () => {
    const events = [start('p1'), message('m2', 'actually'), route('m2', 'p1', 'steered')]
    expect(badgeOf(events, 'm2')).toBe('steering')
    expect(badgeOf([...events, end('p1')], 'm2')).toBe('steered')
  })

  it('takes the later route when a refused steer falls back to the queue', () => {
    const events = [
      start('p1'),
      message('m3', 'actually'),
      route('m3', 'p1', 'steered'),
      end('p1'),
      route('m3', 'p2', 'queued')
    ]
    expect(badgeOf(events, 'm3')).toBe('queued')
    expect(badgeOf([...events, start('p2')], 'm3')).toBeUndefined()
  })

  it('leaves plain messages unbadged', () => {
    expect(badgeOf([message('m4', 'hi')], 'm4')).toBeUndefined()
  })
})
