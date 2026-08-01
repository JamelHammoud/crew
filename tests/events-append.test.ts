import { describe, expect, it } from 'vitest'
import { appendEvent, trimEvents, type SessionEvent } from '../src/shared/events'

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

const ended = (promptId: string): SessionEvent => ({
  id: `e${seq++}`,
  ts: seq,
  kind: 'agent.end',
  promptId,
  agentId: 'ag',
  agentLabel: 'Agent',
  ok: true
})

const doc = (): SessionEvent => ({ id: `d${seq++}`, ts: seq, kind: 'doc', page: 'main', text: 'draft', byName: 'A' })

const joined = (): SessionEvent => ({ id: `j${seq++}`, ts: seq, kind: 'person.joined', memberId: 'm1', name: 'A' })

// A session shaped the way a real one is: long runs of steps under one start,
// chat either side of them, and the events that ride in the snapshot mixed in.
const session = (): SessionEvent[] => {
  const out: SessionEvent[] = []
  for (let run = 0; run < 40; run++) {
    out.push(message())
    if (run % 5 === 0) out.push(joined())
    out.push(start(`p${run}`))
    for (let i = 0; i < 30 + (run % 7) * 20; i++) out.push(step(`p${run}`))
    out.push(ended(`p${run}`))
    if (run % 3 === 0) out.push(doc())
    if (run % 4 === 0) out.push(message())
  }
  return out
}

const walk = (stream: SessionEvent[], limit: number): { held: SessionEvent[]; whole: SessionEvent[] }[] => {
  const out: { held: SessionEvent[]; whole: SessionEvent[] }[] = []
  let held: SessionEvent[] = []
  let whole: SessionEvent[] = []
  for (const event of stream) {
    held = appendEvent(held, event, limit)
    whole = trimEvents([...whole, event], limit)
    out.push({ held, whole })
  }
  return out
}

describe('a window taking one more event', () => {
  it('lands what trimming the whole list again lands, every time', () => {
    for (const limit of [3, 10, 50]) {
      for (const { held, whole } of walk(session(), limit)) expect(held).toEqual(whole)
    }
  })

  it('takes a run’s steps with it when its start falls off the front', () => {
    const held = [start('old'), step('old'), message(), start('new'), step('new')]
    const landed = appendEvent(held, message(), 3)

    expect(landed.some(e => e.kind === 'agent.step' && e.promptId === 'old')).toBe(false)
    expect(landed.some(e => e.kind === 'agent.step' && e.promptId === 'new')).toBe(true)
    expect(landed).toEqual(trimEvents([...held, landed[landed.length - 1]], 3))
  })

  it('leaves out a step whose run has already left the window', () => {
    const held = [message(), message()]

    expect(appendEvent(held, step('gone'), 10)).toBe(held)
  })

  it('holds the window it was handed for an event that rides in the snapshot', () => {
    const held = [message(), start('p1'), step('p1')]

    expect(appendEvent(held, doc(), 10)).toBe(held)
    expect(appendEvent(held, joined(), 10)).toBe(held)
  })

  it('keeps every step of a long run once its start is in the window', () => {
    let held: SessionEvent[] = []
    held = appendEvent(held, start('p1'), 2)
    for (let i = 0; i < 500; i++) held = appendEvent(held, step('p1'), 2)

    expect(held.filter(e => e.kind === 'agent.step')).toHaveLength(500)
  })
})
