import { describe, expect, it } from 'vitest'
import { acpModels, refreshAcpModels } from '../src/runner/providers/acp-models'
import { grokFields } from '../src/runner/providers/grok'
import { settingOptions } from '../src/shared/llm'

const initCatalog = String.raw`
process.stdin.setEncoding('utf8')
let held = ''
process.stdin.on('data', chunk => {
  held += chunk
  const lines = held.split('\n')
  held = lines.pop() ?? ''
  for (const line of lines) {
    const message = JSON.parse(line)
    if (message.method !== 'initialize') continue
    process.stdout.write(JSON.stringify({ id: message.id, result: { _meta: { modelState: { availableModels: [
      { modelId: 'grok-new', name: 'Grok New', _meta: { reasoningEfforts: [
        { value: 'high', label: 'High' }, { value: 'max', label: 'Maximum' }
      ] } },
      { modelId: 'grok-small', name: 'Grok Small', _meta: { reasoningEfforts: [
        { value: 'low', label: 'Low' }
      ] } }
    ] } } } }) + '\n')
  }
})
`

const sessionCatalog = String.raw`
process.stdin.setEncoding('utf8')
let held = ''
process.stdin.on('data', chunk => {
  held += chunk
  const lines = held.split('\n')
  held = lines.pop() ?? ''
  for (const line of lines) {
    const message = JSON.parse(line)
    if (message.method === 'initialize') {
      process.stdout.write(JSON.stringify({ id: message.id, result: { protocolVersion: 1 } }) + '\n')
    }
    if (message.method === 'session/new') {
      process.stdout.write(JSON.stringify({ id: message.id, result: { sessionId: 'one', configOptions: [
        { id: 'model', category: 'model', options: [
          { value: 'first/model', name: 'First' }, { value: 'second/model', name: 'Second' }
        ] }
      ] } }) + '\n')
    }
  }
})
`

describe('ACP model discovery', () => {
  it('reads models and their reasoning levels from initialization', async () => {
    expect(
      await refreshAcpModels({ provider: 'grok', command: process.execPath, args: ['-e', initCatalog], timeoutMs: 2000 })
    ).toBe(true)
    expect(acpModels('grok').map(model => model.value)).toEqual(['grok-new', 'grok-small'])
    const [model, effort] = grokFields()
    expect(model.options?.map(option => option.value)).toEqual(['', 'grok-new', 'grok-small'])
    expect(settingOptions(effort, { model: 'grok-new' }).map(option => option.value)).toEqual(['', 'high', 'max'])
  })

  it('reads model configuration from a new session when initialization has no catalog', async () => {
    expect(
      await refreshAcpModels({
        provider: 'configured',
        command: process.execPath,
        args: ['-e', sessionCatalog],
        timeoutMs: 2000
      })
    ).toBe(true)
    expect(acpModels('configured')).toEqual([
      { value: 'first/model', label: 'First', efforts: [] },
      { value: 'second/model', label: 'Second', efforts: [] }
    ])
  })
})
