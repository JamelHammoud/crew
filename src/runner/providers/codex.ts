import type { AgentSettingField } from '../../shared/llm'
import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { codexModels } from './codex-models'
import type { Provider } from './types'

export const codexFields = (): AgentSettingField[] => {
  const { models, efforts } = codexModels()
  return [
    { key: 'model', label: 'Model', options: choices(['', ...models]), default: '' },
    { key: 'effort', label: 'Thinking', options: choices(efforts), default: 'high' }
  ]
}

export const codexArgs = (prompt: string, get: SettingReader): string[] => [
  'exec',
  '--dangerously-bypass-approvals-and-sandbox',
  ...flag('--model', get('model')),
  ...flag('-c', get('effort') ? `model_reasoning_effort="${get('effort')}"` : ''),
  prompt
]

export const codexProvider: Provider = makeCliProvider({
  name: 'codex',
  label: 'Codex',
  command: 'codex',
  fields: codexFields,
  args: codexArgs
})
