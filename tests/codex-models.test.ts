import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { codexModels } from '../src/runner/providers/codex-models'
import { tmpDir } from './helpers/session'

const cache = {
  models: [
    {
      slug: 'gpt-5.5',
      visibility: 'list',
      priority: 7,
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }]
    },
    {
      slug: 'gpt-5.6-sol',
      visibility: 'list',
      priority: 1,
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }, { effort: 'ultra' }]
    },
    {
      slug: 'gpt-5.4',
      visibility: 'hide',
      priority: 16,
      supported_reasoning_levels: [{ effort: 'medium' }]
    }
  ]
}

const writeCache = (data: unknown): string => {
  const home = tmpDir('codex-home')
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(home, '.codex', 'models_cache.json'), JSON.stringify(data))
  return home
}

describe('codexModels', () => {
  it('lists visible models from the cli cache sorted by priority', () => {
    const { models, efforts } = codexModels(writeCache(cache))
    expect(models).toEqual(['gpt-5.6-sol', 'gpt-5.5'])
    expect(efforts).toEqual(['low', 'high', 'ultra'])
  })

  it('falls back to known models when the cache is missing or unusable', () => {
    expect(codexModels(tmpDir('codex-nohome')).models).toContain('gpt-5.6-sol')
    expect(codexModels(writeCache({ models: [] })).models).toContain('gpt-5.6-sol')
    expect(codexModels(writeCache('nonsense')).models.length).toBeGreaterThan(0)
  })
})
