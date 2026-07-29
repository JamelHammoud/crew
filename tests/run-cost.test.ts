import { describe, expect, it } from 'vitest'
import { addUsage, NO_USAGE, priceOf, rateOf } from '../src/shared/pricing'
import { usageFrom } from '../src/runner/providers/tokens'
import { parseClaudeLine } from '../src/runner/providers/claude'
import { parseCodexLine } from '../src/runner/providers/codex'
import { makeFakeProvider } from './helpers/fake-provider'
import { tmpDir } from './helpers/session'

describe('what a run is worth', () => {
  it('prices a model by the longest row that names it', () => {
    expect(rateOf('claude-opus-4-5-20251101')).toEqual([5, 25])
    expect(rateOf('claude-opus-4-1-20250805')).toEqual([15, 75])
    expect(rateOf('claude-sonnet-5')).toEqual([3, 15])
  })

  // A wrong number costs more than a missing one, so a model nobody has priced
  // comes back as nothing rather than as the nearest guess.
  it('says nothing about a model it has no rate for', () => {
    expect(rateOf('gpt-5.6-sol')).toBeNull()
    expect(priceOf('gpt-5.6-sol', { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 })).toBeNull()
    expect(priceOf('', NO_USAGE)).toBeNull()
  })

  // A cached prefix is read at a tenth of the input rate and written at a
  // quarter more, which is most of what a long agentic run actually spends.
  it('charges a cached prefix at its own rate', () => {
    const dollars = priceOf('claude-opus-5', {
      input: 1_000_000,
      output: 1_000_000,
      cacheRead: 1_000_000,
      cacheWrite: 1_000_000
    })
    expect(dollars).toBeCloseTo(5 + 25 + 0.5 + 6.25, 6)
  })

  it('adds what one call cost onto the run', () => {
    const first = addUsage(NO_USAGE, { input: 10, output: 2 })
    expect(addUsage(first, { output: 3, cacheRead: 40 })).toEqual({
      input: 10,
      output: 5,
      cacheRead: 40,
      cacheWrite: 0
    })
  })
})

describe('reading what a CLI says about its tokens', () => {
  // Anthropic counts a cached prefix beside the input and OpenAI counts it
  // inside. Read the wrong way round, the same prefix is charged twice.
  it('keeps a cached prefix out of the input either way it is reported', () => {
    expect(usageFrom({ input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 900 })).toEqual({
      model: undefined,
      input: 100,
      output: 20,
      cacheRead: 900,
      cacheWrite: undefined
    })
    expect(usageFrom({ input_tokens: 1000, output_tokens: 20, cached_input_tokens: 900 })).toEqual({
      model: undefined,
      input: 100,
      output: 20,
      cacheRead: 900
    })
  })

  it('is nothing at all when a line carries no numbers', () => {
    expect(usageFrom(undefined)).toBeNull()
    expect(usageFrom({})).toBeNull()
    expect(usageFrom({ service_tier: 'standard' })).toBeNull()
  })

  it('carries the model a call really used', () => {
    const [, usage] = parseClaudeLine(
      '{"type":"assistant","message":{"model":"claude-opus-5","content":[{"type":"text","text":"ok"}],"usage":{"input_tokens":12,"output_tokens":3,"cache_read_input_tokens":900,"cache_creation_input_tokens":40}}}'
    )
    expect(usage.usage).toEqual({
      model: 'claude-opus-5',
      input: 12,
      output: 3,
      cacheRead: 900,
      cacheWrite: 40
    })
  })

  // The CLI has already priced the turn against the model it really used, so
  // that figure is the run's and nothing works one out beside it.
  it('takes the price the CLI worked out for itself', () => {
    expect(
      parseClaudeLine('{"type":"result","subtype":"success","usage":{"output_tokens":9},"total_cost_usd":0.42}')
    ).toEqual([{ turnEnd: true }, { usage: { output: 9, cost: 0.42, total: true } }])
  })

  it('reads a turn total as the whole of it rather than as one more call', () => {
    expect(parseCodexLine('{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":8}}')).toEqual([
      { usage: { input: 100, output: 8, total: true } }
    ])
  })
})

describe('a run reporting what it spent', () => {
  const repo = tmpDir('run-cost')

  const spend = async (usage: string): Promise<Array<{ tokens: number; cost: number | null }>> => {
    const said: Array<{ tokens: number; cost: number | null }> = []
    const run = makeFakeProvider({ FAKE_CLI_USAGE: usage }).start('count it', repo, {
      onStep: () => {},
      onTokens: (tokens, cost) => said.push({ tokens, cost })
    })
    await run.done
    return said
  }

  it('adds the calls up and prices them as they land', async () => {
    const said = await spend(
      ['USAGE claude-opus-5 1000000 1000000 0 0', 'USAGE claude-opus-5 1000000 1000000 0 0'].join('\n')
    )
    const last = said[said.length - 1]
    expect(last.tokens).toBe(2_000_000)
    expect(last.cost).toBeCloseTo(60, 6)
  })

  // The end of a turn says what the whole of it came to. Counted beside the
  // calls it is made of rather than in place of them, every token lands twice.
  it('lets the whole turn stand in place of its parts', async () => {
    const said = await spend(
      ['USAGE claude-opus-5 1000000 1000000 0 0', 'TOTAL claude-opus-5 1000000 1000000 0 0'].join('\n')
    )
    const last = said[said.length - 1]
    expect(last.tokens).toBe(1_000_000)
    expect(last.cost).toBeCloseTo(30, 6)
  })

  it('takes the price the run gave over the one off the table', async () => {
    const said = await spend('TOTAL claude-opus-5 1000000 1000000 0 0 0.17')
    expect(said[said.length - 1].cost).toBeCloseTo(0.17, 6)
  })

  it('says nothing about the price of a model it cannot price', async () => {
    const said = await spend('USAGE gpt-5.6-sol 1000000 1000000 0 0')
    const last = said[said.length - 1]
    expect(last.tokens).toBe(1_000_000)
    expect(last.cost).toBeNull()
  })
})
