import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'
import { VoiceReply } from '../src/shared/voiceReply'
import { endOf, findTurn, HeldTurn, stillGoing, textOf, worthSending } from '../src/renderer/src/media/voice/turn'

let clock = 0
const at = () => ++clock

const startEvent = (
  promptId: string,
  threadId: string,
  agentId: string,
  byName: string,
  promptText: string
): SessionEvent => ({
  id: `s-${promptId}`,
  ts: at(),
  kind: 'agent.start',
  promptId,
  agentId,
  agentLabel: agentId,
  promptText,
  byName,
  threadId
})

const endEvent = (promptId: string, threadId: string, text: string, ok = true): SessionEvent => ({
  id: `e-${promptId}`,
  ts: at(),
  kind: 'agent.end',
  promptId,
  agentId: 'a',
  agentLabel: 'a',
  ok,
  text: ok ? text : undefined,
  error: ok ? undefined : text,
  threadId
})

const step = (id: string, text: string, kind: AgentStep['kind'] = 'text'): AgentStep => ({
  id,
  ts: 1,
  kind,
  status: 'running',
  text
})

describe('finding the run this window just asked for', () => {
  it('matches on the words it was started with', () => {
    const events = [
      startEvent('p1', 't1', 'a', 'sam', 'something else'),
      startEvent('p2', 't2', 'a', 'sam', 'what broke')
    ]
    expect(findTurn(events, { byName: 'sam', agentId: 'a', text: 'what broke', threadId: null })).toEqual({
      promptId: 'p2',
      threadId: 't2'
    })
  })

  it('is not somebody else saying the same thing', () => {
    const events = [startEvent('p1', 't1', 'a', 'pat', 'what broke')]
    expect(findTurn(events, { byName: 'sam', agentId: 'a', text: 'what broke', threadId: null })).toBeNull()
  })

  it('is not the same words asked of another agent', () => {
    const events = [startEvent('p1', 't1', 'b', 'sam', 'what broke')]
    expect(findTurn(events, { byName: 'sam', agentId: 'a', text: 'what broke', threadId: null })).toBeNull()
  })

  // Once a conversation has a thread, that is what says which run is ours, and
  // the agent may have been swapped since.
  it('follows the thread once there is one', () => {
    const events = [
      startEvent('p1', 't1', 'a', 'sam', 'again'),
      startEvent('p2', 't2', 'a', 'sam', 'again')
    ]
    expect(findTurn(events, { byName: 'sam', agentId: 'a', text: 'again', threadId: 't1' })?.promptId).toBe('p1')
  })

  it('takes the newest when the same thing was said twice', () => {
    const events = [
      startEvent('p1', 't1', 'a', 'sam', 'again'),
      startEvent('p2', 't1', 'a', 'sam', 'again')
    ]
    expect(findTurn(events, { byName: 'sam', agentId: 'a', text: 'again', threadId: 't1' })?.promptId).toBe('p2')
  })

  it('is nothing until the run has started', () => {
    expect(findTurn([], { byName: 'sam', agentId: 'a', text: 'hello', threadId: null })).toBeNull()
  })
})

describe('the words of a reply', () => {
  it('is the text and never the thinking', () => {
    const steps = [step('b0', 'weighing it', 'thinking'), step('b1', 'It passed.'), step('b2', 'Two of them.')]
    expect(textOf(steps)).toBe('It passed.\nTwo of them.')
  })

  it('is nothing when there is nothing yet', () => {
    expect(textOf(undefined)).toBe('')
    expect(textOf([step('b0', 'hmm', 'thinking')])).toBe('')
  })
})

describe('how a run ended', () => {
  it('reads the reply back', () => {
    expect(endOf([endEvent('p1', 't1', 'all done')], 'p1')).toEqual({ ok: true, text: 'all done' })
  })

  it('reads a failure back as the failure', () => {
    expect(endOf([endEvent('p1', 't1', 'it blew up', false)], 'p1')).toEqual({ ok: false, text: 'it blew up' })
  })

  it('is nothing while the run is going', () => {
    expect(endOf([], 'p1')).toBeNull()
  })
})

describe('what is worth sending on', () => {
  it('keeps a real thing somebody said', () => {
    expect(worthSending('run the tests')).toBe(true)
    expect(worthSending('42')).toBe(true)
  })

  it('drops silence that whisper wrote something into', () => {
    expect(worthSending('')).toBe(false)
    expect(worthSending('  ')).toBe(false)
    expect(worthSending('.')).toBe(false)
    expect(worthSending('...')).toBe(false)
  })
})

describe('a pause somebody took against a turn they finished', () => {
  it('answers a finished thought at once', () => {
    expect(stillGoing('run the tests')).toBe(false)
    expect(stillGoing('two of them are failing.')).toBe(false)
    expect(stillGoing('what broke?')).toBe(false)
    expect(stillGoing('wait!')).toBe(false)
  })

  it('waits on somebody who is plainly still going', () => {
    expect(stillGoing('and then')).toBe(true)
    expect(stillGoing('the other thing is')).toBe(true)
    expect(stillGoing('if we could just...')).toBe(true)
    expect(stillGoing('so basically')).toBe(true)
    expect(stillGoing('it waits two seconds after I,')).toBe(true)
  })

  it('waits on a question that has not been asked yet', () => {
    expect(stillGoing('what I want to know is')).toBe(true)
  })

  it('answers nothing at all', () => {
    expect(stillGoing('')).toBe(false)
    expect(stillGoing('   ')).toBe(false)
  })

  it('sends the whole thought once the rest of it arrives', () => {
    const held = new HeldTurn()
    expect(held.add('So basically')).toBe(null)
    expect(held.waiting).toBe('So basically')
    expect(held.add('the tests are slow.')).toBe('So basically the tests are slow.')
    expect(held.waiting).toBe('')
  })

  it('keeps holding while every piece trails off', () => {
    const held = new HeldTurn()
    expect(held.add('I want to make it faster because')).toBe(null)
    expect(held.add('right now it waits like two seconds and')).toBe(null)
    expect(held.add('then it answers.')).toBe('I want to make it faster because right now it waits like two seconds and then it answers.')
  })

  it('takes the dash off the end of a piece it joins', () => {
    const held = new HeldTurn()
    expect(held.add('two seconds after I-')).toBe(null)
    expect(held.add('finish speaking.')).toBe('two seconds after I finish speaking.')
  })

  it('sends what it was holding when nothing else comes', () => {
    const held = new HeldTurn()
    held.add('and then')
    expect(held.take()).toBe('and then')
    expect(held.take()).toBe('')
  })

  it('never holds a finished sentence', () => {
    const held = new HeldTurn()
    expect(held.add('run the tests')).toBe('run the tests')
    expect(held.waiting).toBe('')
  })
})

// The whole path a reply takes, without a store or a speaker anywhere near it:
// the run is found, the text is spoken as it grows, and the end says the rest.
describe('a turn from asking to said', () => {
  it('says the reply once, in order, with the card taken out', () => {
    const events: SessionEvent[] = []
    const said: string[] = []
    const drawn: string[] = []
    const asked = 'what broke'

    events.push(startEvent('p1', 't1', 'a', 'sam', asked))
    const turn = findTurn(events, { byName: 'sam', agentId: 'a', text: asked, threadId: null })!
    expect(turn.threadId).toBe('t1')

    const reply = new VoiceReply()
    const arriving = [
      'Two tests failed.',
      'Two tests failed. Both are in the parser.',
      'Two tests failed. Both are in the parser.\n```card\n{"kind":"list","items":["quotes","escapes"]}\n```\n'
    ]
    for (const text of arriving) {
      const grown = reply.grew(textOf([step('b0', text)]))
      if (grown.say) said.push(grown.say)
      for (const card of grown.cards) drawn.push(card.kind)
    }

    const whole = arriving.at(-1)!
    events.push(endEvent('p1', 't1', whole))
    const ended = endOf(events, 'p1')!
    const rest = reply.whole(ended.text)
    if (rest.say) said.push(rest.say)
    for (const card of rest.cards) drawn.push(card.kind)

    expect(said.join(' ')).toBe('Two tests failed. Both are in the parser.')
    expect(drawn).toEqual(['list'])
  })
})
