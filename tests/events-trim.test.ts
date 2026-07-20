import { describe, expect, it } from 'vitest'
import { trimEvents, type SessionEvent } from '../src/shared/events'

let seq = 0
const message = (): SessionEvent => ({
  id: `m${seq++}`,
  ts: seq,
  kind: 'message',
  authorId: 'a',
  authorName: 'A',
  text: 'hi',
  mentions: []
})
const start = (promptId: string): SessionEvent => ({
  id: `s${seq++}`,
  ts: seq,
  kind: 'agent.start',
  promptId,
  agentId: 'ag',
  agentLabel: 'Agent',
  promptText: 'go',
  byName: 'A'
})
const step = (promptId: string): SessionEvent => ({
  id: `p${seq++}`,
  ts: seq,
  kind: 'agent.step',
  promptId,
  agentId: 'ag',
  agentLabel: 'Agent',
  step: { id: `b${seq}`, ts: seq, kind: 'tool', status: 'done', name: 'Bash' }
})

describe('trimEvents', () => {
  it('does not count steps against the limit', () => {
    const events = [message(), start('p1'), ...Array.from({ length: 200 }, () => step('p1')), message()]
    const trimmed = trimEvents(events, 3)
    expect(trimmed.filter(e => e.kind === 'message')).toHaveLength(2)
    expect(trimmed.filter(e => e.kind === 'agent.step')).toHaveLength(200)
  })

  it('drops steps whose prompt start fell outside the window', () => {
    const events = [start('old'), step('old'), ...Array.from({ length: 5 }, message), start('new'), step('new')]
    const trimmed = trimEvents(events, 6)
    expect(trimmed.some(e => e.kind === 'agent.step' && e.promptId === 'old')).toBe(false)
    expect(trimmed.some(e => e.kind === 'agent.step' && e.promptId === 'new')).toBe(true)
  })

  it('keeps everything under the limit', () => {
    const events = [message(), start('p1'), step('p1'), message()]
    expect(trimEvents(events, 10)).toEqual(events)
  })
})
