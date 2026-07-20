import { describe, expect, it } from 'vitest'
import { buildThread } from '../src/renderer/src/components/thread'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'

const THREAD = 't1'

const message = (id: string, ts: number, text: string): SessionEvent => ({
  id,
  ts,
  kind: 'message',
  authorId: 'sam',
  authorName: 'Sam',
  text,
  mentions: [],
  threadId: THREAD
})

const start = (promptId: string, ts: number): SessionEvent => ({
  id: `s-${promptId}`,
  ts,
  kind: 'agent.start',
  promptId,
  agentId: 'a1',
  agentLabel: 'Claude',
  promptText: '',
  byName: 'Sam',
  threadId: THREAD
})

const step = (id: string, ts: number, text: string): AgentStep => ({
  id,
  ts,
  kind: 'text',
  status: 'done',
  text
})

describe('thread ordering', () => {
  it('places a steered message between the steps it arrived among', () => {
    const events = [start('p1', 1), message('m1', 5, 'actually, try this')]
    const steps = { p1: [step('st1', 2, 'before the steer'), step('st2', 8, 'after the steer')] }
    const keys = buildThread(events, steps, 'sam').map(item => item.key)
    expect(keys).toEqual(['p1:st1', 'm1', 'p1:st2'])
  })

  it('keeps event-log order for items sharing a timestamp', () => {
    const events = [message('m1', 3, 'go'), start('p1', 3)]
    const steps = { p1: [step('st1', 3, 'reply')] }
    const keys = buildThread(events, steps, 'sam').map(item => item.key)
    expect(keys).toEqual(['m1', 'p1:st1'])
  })
})
