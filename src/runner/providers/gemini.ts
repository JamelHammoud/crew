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

// Gemini runs on `gemini --acp`, the Agent Client Protocol server inside the
// same CLI everybody already has, which is the door Kimi is already on.
// `gemini -p --output-format stream-json` is the other one, and it says most of
// it: a streamed answer, a tool named with its real arguments, and what the
// turn cost. What it has no channel for at all is reasoning, and it is one shot,
// so there is nothing to steer. Those are the two the transport decides, and
// they are the two worth having.
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
