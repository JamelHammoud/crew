import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { codexModels, refreshCodexModels } from '../src/runner/providers/codex-models'
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
      slug: 'gpt-6-astra',
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

const fakeServer = String.raw`
process.stdin.setEncoding('utf8')
let held = ''
process.stdin.on('data', chunk => {
  held += chunk
  const lines = held.split('\n')
  held = lines.pop() ?? ''
  for (const line of lines) {
    const message = JSON.parse(line)
    if (message.method === 'initialize') {
      process.stdout.write(JSON.stringify({ id: message.id, result: { userAgent: 'fake' } }) + '\n')
    }
    if (message.method === 'model/list' && !message.params.cursor) {
      process.stdout.write(JSON.stringify({ id: message.id, result: { data: [
        { model: 'gpt-new', hidden: false, supportedReasoningEfforts: [{ reasoningEffort: 'medium' }] },
        { model: 'gpt-hidden', hidden: true, supportedReasoningEfforts: [{ reasoningEffort: 'max' }] }
      ], nextCursor: 'next' } }) + '\n')
    }
    if (message.method === 'model/list' && message.params.cursor === 'next') {
      process.stdout.write(JSON.stringify({ id: message.id, result: { data: [
        { model: 'gpt-next', hidden: false, supportedReasoningEfforts: [{ reasoningEffort: 'high' }] }
      ], nextCursor: null } }) + '\n')
    }
  }
})
`

describe('codexModels', () => {
  it('lists visible models from the CLI cache sorted by priority', () => {
    const { models, efforts } = codexModels(writeCache(cache))
    expect(models).toEqual(['gpt-6-astra', 'gpt-5.5'])
    expect(efforts).toEqual(['low', 'high', 'ultra'])
  })

  it('does not replace missing CLI data with a maintained model list', () => {
    expect(codexModels(tmpDir('codex-nohome'))).toEqual({ models: [], efforts: [] })
    expect(codexModels(writeCache({ models: [] }))).toEqual({ models: [], efforts: [] })
    expect(codexModels(writeCache('nonsense'))).toEqual({ models: [], efforts: [] })
  })

  it('reads every visible model from the app-server catalog', async () => {
    const home = tmpDir('codex-live-home')
    expect(
      await refreshCodexModels({ command: process.execPath, args: ['-e', fakeServer], home, timeoutMs: 2000 })
    ).toBe(true)
    expect(codexModels(home)).toEqual({ models: ['gpt-new', 'gpt-next'], efforts: ['medium', 'high'] })
  })
})
