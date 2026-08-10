import type { SessionEvent } from '../../../../shared/events'
import type { AgentStep } from '../../../../shared/llm'

// Which run in the session is the one this window just asked for. Nothing has
// to be minted or handed back for this: the start of a run already carries the
// words it was started with, so the turn finds itself.

export interface Turn {
  promptId: string
  threadId: string
}

export interface Asked {
  byName: string
  agentId: string
  text: string
  // Set from the second turn on, once the conversation has a thread of its own.
  threadId: string | null
}

export function findTurn(events: readonly SessionEvent[], asked: Asked): Turn | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.kind !== 'agent.start' || !event.threadId) continue
    if (event.byName !== asked.byName || event.promptText !== asked.text) continue
    if (asked.threadId ? event.threadId !== asked.threadId : event.agentId !== asked.agentId) continue
    return { promptId: event.promptId, threadId: event.threadId }
  }
  return null
}

// The words of the reply as they stand. Thinking is not part of it: it is the
// model talking to itself, and reading it out is reading somebody's notes.
export function textOf(steps: readonly AgentStep[] | undefined): string {
  return (steps ?? [])
    .filter(step => step.kind === 'text' && step.text)
    .map(step => step.text!)
    .join('\n')
}

export interface Ended {
  ok: boolean
  text: string
}

export function endOf(events: readonly SessionEvent[], promptId: string): Ended | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.kind !== 'agent.end' || event.promptId !== promptId) continue
    return { ok: event.ok, text: event.ok ? (event.text ?? '') : (event.error ?? '') }
  }
  return null
}

// What the agent gets sent is not what was heard. Whisper writes out numbers
// and names the way it heard them and nothing else needs doing to it, but an
// utterance with nothing in it is silence somebody made a noise during, and
// sending that starts a run over nothing.
export function worthSending(heard: string): boolean {
  return /[a-z0-9]/i.test(heard) && heard.trim().length > 1
}

export const HOLD_MS = 700

const CARRIES_ON = new Set([
  'and',
  'but',
  'or',
  'so',
  'because',
  'cause',
  'since',
  'although',
  'though',
  'unless',
  'until',
  'while',
  'when',
  'where',
  'whether',
  'if',
  'plus',
  'then',
  'also',
  'other',
  'another',
  'the',
  'a',
  'an',
  'my',
  'your',
  'our',
  'their',
  'this',
  'these',
  'to',
  'of',
  'for',
  'with',
  'about',
  'into',
  'from',
  'is',
  'are',
  'was',
  'were',
  'am',
  'be',
  'been',
  'do',
  'does',
  'did',
  'can',
  'could',
  'will',
  'would',
  'should',
  'might',
  'must',
  'have',
  'has',
  'had',
  'like',
  'just',
  'maybe',
  'basically',
  'actually',
  'literally',
  'probably',
  'um',
  'umm',
  'uh',
  'uhh',
  'er',
  'erm'
])

const ASKED = /[?!]["')\]]*$/
const OPEN_END = /(?:[,;:]|\.\.\.|…|[-–—]+)["')\]]*$/
const TRAILED = /\s*[-–—]+\s*$/

export function stillGoing(heard: string): boolean {
  const text = heard.trim()
  if (!text) return false
  if (ASKED.test(text)) return false
  if (OPEN_END.test(text)) return true
  const words = text.toLowerCase().match(/[a-z']+/g)
  return words ? CARRIES_ON.has(words[words.length - 1]) : false
}

export class HeldTurn {
  private held = ''

  get waiting(): string {
    return this.held
  }

  add(heard: string): string | null {
    const text = heard.trim()
    const whole = this.held ? `${this.held.replace(TRAILED, '')} ${text}` : text
    if (stillGoing(whole)) {
      this.held = whole
      return null
    }
    this.held = ''
    return whole
  }

  take(): string {
    const held = this.held
    this.held = ''
    return held
  }

  clear(): void {
    this.held = ''
  }
}
