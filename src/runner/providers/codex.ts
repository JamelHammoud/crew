import { choices, flag, makeCliProvider } from './cli'
import type { Provider } from './types'

export const codexProvider: Provider = makeCliProvider({
  name: 'codex',
  label: 'Codex',
  command: 'codex',
  fields: () => [
    { key: 'model', label: 'Model', options: choices(['', 'gpt-5.1-codex', 'gpt-5.1-codex-max']), default: '' },
    { key: 'effort', label: 'Thinking', options: choices(['low', 'medium', 'high']), default: 'high' }
  ],
  args: (prompt, get) => [
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    ...flag('--model', get('model')),
    ...flag('-c', get('effort') ? `model_reasoning_effort="${get('effort')}"` : ''),
    prompt
  ]
})
