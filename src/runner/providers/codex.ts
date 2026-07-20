import type { AgentSettingField } from '../../shared/llm'
import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import type { Provider } from './types'

export const codexFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', 'gpt-5.1-codex', 'gpt-5.1-codex-max']), default: '' },
  { key: 'effort', label: 'Thinking', options: choices(['low', 'medium', 'high']), default: 'high' }
]

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
