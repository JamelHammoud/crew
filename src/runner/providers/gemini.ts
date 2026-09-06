import type { AgentSettingField } from '../../shared/llm'
import { choices, makeCliProvider } from './cli'
import { geminiDialog, geminiParser } from './gemini-acp'
import { acpModels, refreshAcpModels } from './acp-models'
import type { Provider } from './types'

export const GEMINI_MODES = [
  { value: '', label: 'Anything' },
  { value: 'auto_edit', label: 'Safe changes' },
  { value: 'default', label: 'Ask first' },
  { value: 'plan', label: 'Read only' }
]

export const geminiFields = (): AgentSettingField[] => [
  {
    key: 'model',
    label: 'Model',
    options: [{ value: '', label: 'Default' }, ...acpModels('gemini')],
    default: '',
    free: true
  },
  {
    key: 'mode',
    label: 'What it may do',
    options: GEMINI_MODES,
    default: '',
    advanced: true,
    section: 'On this computer'
  },
  {
    key: 'dirs',
    label: 'Other folders it can read',
    kind: 'text',
    default: '',
    advanced: true,
    section: 'On this computer',
    placeholder: 'None',
    line: 'Separated by commas.'
  }
]

export const geminiArgs = (_prompt: string, get: (key: string) => string): string[] => {
  const model = get('model')
  const mode = get('mode')
  const dirs = get('dirs').trim()
  return [
    '--acp',
    ...(mode ? ['--approval-mode', mode] : ['--yolo']),
    ...(model ? ['--model', model] : []),
    ...(dirs ? ['--include-directories', dirs] : [])
  ]
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
  discover: () => refreshAcpModels({ provider: 'gemini', args: ['--acp', '--yolo'] }),
  install: { darwin: INSTALL, linux: INSTALL, win32: INSTALL }
})
