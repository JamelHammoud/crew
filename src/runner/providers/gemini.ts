import type { AgentSettingField } from '../../shared/llm'
import { choices, makeCliProvider } from './cli'
import { geminiDialog, geminiParser } from './gemini-acp'
import type { Provider } from './types'

const MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]

export const geminiFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', ...MODELS]), default: '' }
]

export const geminiArgs = (_prompt: string, get: (key: string) => string): string[] => {
  const model = get('model')
  return ['--acp', '--yolo', ...(model ? ['--model', model] : [])]
}

const INSTALL = 'npm install -g @google/gemini-cli'

export const geminiProvider: Provider = makeCliProvider({
  name: 'gemini',
  label: 'Gemini',
  command: 'gemini',
  fields: geminiFields,
  args: geminiArgs,
  makeParser: geminiParser,
  dialog: (prompt, cwd, get, run) => geminiDialog(prompt, cwd, get, run),
  steerable: true,
  mcp: 'inline',
  install: { darwin: INSTALL, linux: INSTALL, win32: INSTALL }
})
