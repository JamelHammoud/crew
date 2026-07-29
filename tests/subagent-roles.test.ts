import { describe, expect, it } from 'vitest'
import {
  BRIEF_LIMIT,
  cleanSubagent,
  findSubagent,
  NAME_LIMIT,
  returnText,
  SETTING_LIMIT,
  type Subagent
} from '../src/shared/subagents'

const role = (over: Partial<Subagent> = {}): Subagent => ({
  id: 'role-1',
  name: 'Scout',
  brief: 'Reads and reports',
  settings: {},
  createdBy: 'sam',
  ts: 1,
  ...over
})

describe('a helper role', () => {
  it('needs a name and something to say what it is for', () => {
    expect(cleanSubagent('', 'reads things')).toBeNull()
    expect(cleanSubagent('Scout', '')).toBeNull()
    expect(cleanSubagent('   ', '   ')).toBeNull()
    expect(cleanSubagent('Scout', 'reads things')).toEqual({ name: 'Scout', brief: 'reads things', settings: {} })
  })

  it('trims what it is given and cuts it to what a role can carry', () => {
    const clean = cleanSubagent('  Scout  ', `  ${'x'.repeat(BRIEF_LIMIT + 50)}  `)!
    expect(clean.name).toBe('Scout')
    expect(clean.brief).toHaveLength(BRIEF_LIMIT)
    expect(cleanSubagent('x'.repeat(NAME_LIMIT + 10), 'brief')!.name).toHaveLength(NAME_LIMIT)
  })

  it('leaves the provider out rather than carrying an empty one', () => {
    expect(cleanSubagent('Scout', 'brief', { provider: '   ' })).not.toHaveProperty('provider')
    expect(cleanSubagent('Scout', 'brief', { provider: ' claude ' })!.provider).toBe('claude')
  })

  it('takes only settings that are really settings', () => {
    const many = Object.fromEntries(Array.from({ length: SETTING_LIMIT + 8 }, (_, i) => [`k${i}`, 'v']))
    expect(Object.keys(cleanSubagent('Scout', 'brief', { settings: many })!.settings)).toHaveLength(SETTING_LIMIT)
    const junk = { model: 'opus', bad: 5, '': 'x' } as unknown as Record<string, string>
    expect(cleanSubagent('Scout', 'brief', { settings: junk })!.settings).toEqual({ model: 'opus' })
    expect(cleanSubagent('Scout', 'brief', { settings: null as never })!.settings).toEqual({})
  })

  it('is found by the id it was given or the name a person reads', () => {
    const roles = [role(), role({ id: 'role-2', name: 'Auditor' })]
    expect(findSubagent(roles, 'role-2')?.name).toBe('Auditor')
    expect(findSubagent(roles, 'scout')?.id).toBe('role-1')
    expect(findSubagent(roles, '  AUDITOR ')?.id).toBe('role-2')
    expect(findSubagent(roles, 'nobody')).toBeUndefined()
    expect(findSubagent(roles, '')).toBeUndefined()
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
