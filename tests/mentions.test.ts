import { describe, expect, it } from 'vitest'
import { mentionCandidates, mentionsIn, type AgentStatus } from '../src/shared/llm'

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

describe('mentionCandidates', () => {
  const roster = [
    agent('a', 'Claude'),
    agent('b', 'Kimi'),
    agent('c', 'Codex'),
    agent('d', 'Bob (Kimi K3)'),
    agent('e', 'Timmy'),
    agent('f', 'Codex Sol')
  ]

  it('returns nothing when no @ is being typed', () => {
    expect(mentionCandidates(roster, null)).toEqual([])
  })

  it('lists every online agent for a bare @, with no cap', () => {
    expect(mentionCandidates(roster, '')).toHaveLength(roster.length)
  })

  it('excludes offline agents', () => {
    const list = mentionCandidates([agent('a', 'Gone', 'offline'), agent('b', 'Here')], '')
    expect(list.map(a => a.id)).toEqual(['b'])
  })

  it('ranks prefix matches before substring matches', () => {
    expect(mentionCandidates(roster, 'kimi').map(a => a.id)).toEqual(['b', 'd'])
  })

  it('keeps matching while a multi-word label is typed', () => {
    expect(mentionCandidates(roster, 'bob (ki').map(a => a.id)).toEqual(['d'])
  })

  it('stops matching once the text moves past the label', () => {
    expect(mentionCandidates(roster, 'timmy can you')).toEqual([])
  })
})
