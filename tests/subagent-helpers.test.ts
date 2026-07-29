import { describe, expect, it } from 'vitest'
import {
  cleanHelperName,
  cleanPrefs,
  DEFAULT_FAN,
  DEFAULT_PREFS,
  FAN_LIMIT,
  NAME_LIMIT,
  returnText,
  subagentPreamble
} from '../src/shared/subagents'

describe('the name a helper is sent out under', () => {
  it('is whatever the agent wrote, tidied', () => {
    expect(cleanHelperName('  Scout  ')).toBe('Scout')
    expect(cleanHelperName('the\n  docs   one')).toBe('the docs one')
    expect(cleanHelperName('x'.repeat(NAME_LIMIT + 20))).toHaveLength(NAME_LIMIT)
  })

  it('is never nothing, because a nameless chip is worse than a plain one', () => {
    expect(cleanHelperName('')).toBe('Helper')
    expect(cleanHelperName('   ')).toBe('Helper')
    expect(cleanHelperName(undefined)).toBe('Helper')
    expect(cleanHelperName(42)).toBe('Helper')
  })
})

describe('what a machine lets helpers do', () => {
  it('starts on a number a laptop can carry rather than on the ceiling', () => {
    expect(DEFAULT_PREFS).toEqual({ on: true, fan: DEFAULT_FAN })
    expect(DEFAULT_FAN).toBeLessThan(FAN_LIMIT)
  })

  it('holds a number asked for over the ceiling at the ceiling, and under one at one', () => {
    expect(cleanPrefs({ on: true, fan: FAN_LIMIT + 40 }).fan).toBe(FAN_LIMIT)
    expect(cleanPrefs({ on: true, fan: 0 }).fan).toBe(1)
    expect(cleanPrefs({ on: true, fan: -3 }).fan).toBe(1)
    expect(cleanPrefs({ on: true, fan: 2.6 }).fan).toBe(3)
  })

  it('reads anything that is not an answer as the answer everyone starts on', () => {
    expect(cleanPrefs(undefined)).toEqual(DEFAULT_PREFS)
    expect(cleanPrefs(null)).toEqual(DEFAULT_PREFS)
    expect(cleanPrefs({ fan: Number.NaN } as never).fan).toBe(DEFAULT_FAN)
    expect(cleanPrefs({} as never).on).toBe(true)
    expect(cleanPrefs({ on: false } as never).on).toBe(false)
  })
})

describe('the words an agent is given about helpers', () => {
  it('says nothing at all when there is no room for another one', () => {
    expect(subagentPreamble('http://x', 'p1', 0)).toBeNull()
    expect(subagentPreamble('http://x', 'p1', -1)).toBeNull()
  })

  it('carries the promptId the work is claimed with, and how much room is left', () => {
    const said = subagentPreamble('http://host:1', 'prompt-9', 3)!
    expect(said).toContain('http://host:1/agents/spawn')
    expect(said).toContain('prompt-9')
    expect(said).toContain('3 more running at once')
  })

  it('offers a CLI by name only where somebody here is really running one', () => {
    expect(subagentPreamble('http://x', 'p1', 2)).not.toContain('"provider"')
    expect(subagentPreamble('http://x', 'p1', 2, ['claude', 'codex'])).toContain('claude, codex')
  })
})

describe('what the parent reads when one comes home', () => {
  const one = { name: 'Scout', subject: 'the schema', ok: true, ms: 72000, text: 'Six tables.' }

  it('names the helper, how long it took, and what it said', () => {
    const said = returnText([one], [])
    expect(said).toContain('Scout finished after 1m 12s and said:')
    expect(said).toContain('Six tables.')
  })

  it('says who is still out, so the parent knows what it is still waiting on', () => {
    expect(returnText([one], ['Auditor'])).toContain('Auditor is still going.')
    expect(returnText([one], ['Auditor', 'Critic'])).toContain('Auditor and Critic are still going.')
    expect(returnText([one], [])).not.toContain('still going')
  })

  it('gathers a breath of them under one heading rather than three', () => {
    const said = returnText(
      [one, { ...one, name: 'Auditor', text: 'Two failures.' }, { ...one, name: 'Critic', ok: false, text: 'Stopped' }],
      []
    )
    expect(said).toContain('Scout finished')
    expect(said).toContain('Auditor finished')
    expect(said).toContain('Critic stopped after')
  })

  it('says something rather than nothing when a helper answered with nothing', () => {
    expect(returnText([{ ...one, text: '   ' }], [])).toContain('(nothing)')
    expect(returnText([{ ...one, ok: false, text: '' }], [])).toContain('(no reason given)')
  })
})
