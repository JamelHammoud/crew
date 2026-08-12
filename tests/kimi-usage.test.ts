import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { kimiParser } from '../src/runner/providers/kimi-acp'
import { kimiUsage, kimiWire } from '../src/runner/providers/kimi-usage'
import { addUsage, NO_USAGE, priceOf } from '../src/shared/pricing'

const record = (usage: Record<string, number>, scope = 'turn', model = 'kimi-code/k3') =>
  JSON.stringify({ type: 'usage.record', model, usage, usageScope: scope, time: 1785506708991 })

const call = (inputOther: number, output: number, inputCacheRead = 0, inputCacheCreation = 0) =>
  record({ inputOther, output, inputCacheRead, inputCacheCreation })

const noise = JSON.stringify({ type: 'llm.request', provider: 'kimi', model: 'k3' })

describe('what a Kimi turn cost', () => {
  it('adds up every call of the model rather than reading one', () => {
    const usage = kimiUsage([noise, call(2018, 205, 19200), noise, call(218, 180, 20992)].join('\n'))
    expect(usage).toMatchObject({ input: 2236, output: 385, cacheRead: 40192, cacheWrite: 0 })
  })

  it('keeps the cached prefix beside the input rather than inside it', () => {
    const usage = kimiUsage(call(1922, 206, 19200))
    expect(usage?.input).toBe(1922)
    expect(usage?.cacheRead).toBe(19200)
    const priced = addUsage(NO_USAGE, usage!)
    expect(priced.input + priced.cacheRead).toBe(21122)
  })

  it('counts what a whole turn came to in place of its parts', () => {
    expect(kimiUsage(call(10, 20))?.total).toBe(true)
  })

  it('leaves a session total out, so nothing lands twice', () => {
    const text = [
      call(100, 10),
      record({ inputOther: 100, output: 10, inputCacheRead: 0, inputCacheCreation: 0 }, 'session')
    ].join('\n')
    expect(kimiUsage(text)).toMatchObject({ input: 100, output: 10 })
  })

  it('carries the model it really ran on', () => {
    expect(kimiUsage(call(1, 1))?.model).toBe('kimi-code/k3')
  })

  it('draws no price for a model with no rate, rather than a zero', () => {
    expect(priceOf('kimi-code/k3', addUsage(NO_USAGE, kimiUsage(call(2018, 205, 19200))!))).toBeNull()
  })

  it('is nothing at all when no call has been made yet', () => {
    expect(kimiUsage('')).toBeNull()
    expect(kimiUsage(noise)).toBeNull()
  })
})

describe('finding what Kimi wrote down', () => {
  const home = mkdtempSync(join(tmpdir(), 'kimi-home-'))
  const session = 'session_0e8e249d-63fe-4877-865b-4328468937fa'
  const dir = join(home, '.kimi-code', 'sessions', 'wd_crew_dfdd9bb81d4e', session, 'agents', 'main')
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(home, '.kimi-code', 'sessions', 'wd_other_111111111111'), { recursive: true })
  writeFileSync(join(dir, 'wire.jsonl'), call(2018, 205, 19200) + '\n')

  it('finds the log under whichever folder the session landed in', () => {
    expect(kimiUsage(kimiWire(home)(session)!)).toMatchObject({ input: 2018, output: 205 })
  })

  it('is nothing when the session has written nothing yet', () => {
    expect(kimiWire(home)('session_missing')).toBeNull()
  })

  it('is nothing when there is no Kimi on this machine', () => {
    expect(kimiWire(join(home, 'nowhere'))(session)).toBeNull()
  })
})

describe('a run reading its own cost', () => {
  it('says what the turn came to when the turn ends', () => {
    const parse = kimiParser().parse
    parse(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { sessionId: 'session_x' } }))
    const out = parse(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { stopReason: 'end_turn' } }))
    expect(out.some(item => item.turnEnd)).toBe(true)
  })

  it('ends the run when the way in fails, rather than waiting out the clock', () => {
    const parse = kimiParser().parse
    const out = parse(JSON.stringify({ jsonrpc: '2.0', id: 2, error: { code: -32603, message: 'Not logged in.' } }))
    expect(out).toContainEqual({ error: 'Not logged in.' })
    expect(out).toContainEqual({ turnEnd: true })
  })

  it('leaves a run going when a setting is refused after the session is up', () => {
    const parse = kimiParser().parse
    parse(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { sessionId: 'session_x' } }))
    const out = parse(JSON.stringify({ jsonrpc: '2.0', id: 3, error: { code: -32602, message: 'Unknown configId' } }))
    expect(out.some(item => item.turnEnd)).toBe(false)
  })
})
