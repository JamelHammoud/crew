// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import RunEnded from '../src/renderer/src/components/RunEnded'
import { setPref } from '../src/renderer/src/state/prefs'

Element.prototype.getAnimations ??= () => []

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear()
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ended = (
  extra: Partial<Extract<SessionEvent, { kind: 'agent.end' }>> = {}
): Extract<SessionEvent, { kind: 'agent.end' }> => ({
  id: 'e1',
  ts: 1,
  kind: 'agent.end',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Fake',
  ok: true,
  ms: 124_000,
  tokens: 12_400,
  cost: 0.42,
  ...extra
})

const line = (extra: Partial<Extract<SessionEvent, { kind: 'agent.end' }>> = {}) =>
  render(createElement(RunEnded, { end: ended(extra) })).container

describe('what a run that has finished leaves behind', () => {
  it('stays in the thread saying how long it took and what it counted', () => {
    const shown = line().textContent ?? ''
    expect(shown).toContain('2m 4s')
    expect(shown).toContain('12k tokens')
    expect(shown).not.toContain('$')
  })

  it('says the price once it is asked for', () => {
    setPref('cost', true)
    expect(line().textContent ?? '').toContain('$0.42')
  })

  it('drops the count without dropping the rest of it', () => {
    setPref('tokens', false)
    const shown = line().textContent ?? ''
    expect(shown).not.toContain('tokens')
    expect(shown).toContain('2m 4s')
  })

  it('says what a run that failed spent before it did', () => {
    setPref('cost', true)
    const shown = line({ ok: false, error: 'Stopped' }).textContent ?? ''
    expect(shown).toContain('2m 4s')
    expect(shown).toContain('12k tokens')
    expect(shown).toContain('$0.42')
  })

  it('draws nothing at all for a run from before any of this was counted', () => {
    expect(line({ ms: undefined, tokens: undefined, cost: undefined }).textContent).toBe('')
  })

  it('draws no price for a run nobody could price', () => {
    setPref('cost', true)
    expect(line({ cost: undefined }).textContent ?? '').not.toContain('$')
  })
})
