import { describe, expect, it } from 'vitest'
import { mentionsIn, type AgentStatus } from '../src/shared/llm'

const agent = (id: string, label: string, status: AgentStatus = 'idle') => ({ id, label, status })

describe('mentionsIn', () => {
  it('matches an exact label and not a longer one that shares its prefix', () => {
    const agents = [agent('a', 'Claude'), agent('b', 'Claude Opus')]
    expect(mentionsIn('hey @Claude do a thing', agents)).toEqual(['a'])
    expect(mentionsIn('hey @Claude Opus do a thing', agents)).toEqual(['b'])
  })

  it('does not match a label that is only a prefix of the typed token', () => {
    expect(mentionsIn('ping @Claudia', [agent('a', 'Claude')])).toEqual([])
  })

  it('skips offline agents', () => {
    expect(mentionsIn('@Gone you there', [agent('a', 'Gone', 'offline')])).toEqual([])
  })

  it('finds several distinct agents in one message', () => {
    const agents = [agent('a', 'Fake A'), agent('b', 'Fake B')]
    const ids = mentionsIn('@Fake A and @Fake B please', agents)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toHaveLength(2)
  })
})
