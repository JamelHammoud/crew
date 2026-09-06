import type { AgentSettingField } from '../../shared/llm'
import { choices, makeCliProvider } from './cli'
import { kimiDialog, kimiParser } from './kimi-acp'
import { kimiModels } from './kimi-models'
import { acpModels, refreshAcpModels } from './acp-models'
import type { Provider } from './types'

export const KIMI_MODES = [
  { value: 'yolo', label: 'Anything' },
  { value: 'auto', label: 'Safe changes' },
  { value: 'default', label: 'Ask first' },
  { value: 'plan', label: 'Read only' }
]

export const KIMI_THINKING = [
  { value: '', label: 'Default' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' }
]

export const kimiFields = (): AgentSettingField[] => [
  {
    key: 'model',
    label: 'Model',
    options: [
      { value: '', label: 'Default' },
      ...(acpModels('kimi').length ? acpModels('kimi') : choices(kimiModels()))
    ],
    default: '',
    free: true
  },
  {
    key: 'thinking',
    label: 'Thinking',
    options: KIMI_THINKING,
    default: '',
    advanced: true,
    section: 'Thinking'
  },
  {
    key: 'mode',
    label: 'What it may do',
    options: KIMI_MODES,
    default: 'yolo',
    advanced: true,
    section: 'On this computer'
  }
]

// Kimi runs on `kimi acp`, the Agent Client Protocol server inside the same CLI
// everybody already has. `kimi -p --output-format stream-json` was the door
// crew knocked on before, and it only ever says what has already happened: a
// whole answer at the end, a tool call with no arguments until it lands, and no
// reasoning at all. Live thinking, a streamed answer and a named tool with real
// arguments were three names for one thing, which is the transport.
export const kimiArgs = (): string[] => ['acp']

const INSTALL_SH = 'curl -LsSf https://code.kimi.com/install.sh | bash'

export const kimiProvider: Provider = makeCliProvider({
  name: 'kimi',
  label: 'Kimi',
  command: 'kimi',
  fields: kimiFields,
  args: kimiArgs,
  makeParser: kimiParser,
  dialog: (prompt, cwd, get, run) => kimiDialog(prompt, cwd, get, run),
  steerable: true,
  mcp: 'inline',
  discover: () => refreshAcpModels({ provider: 'kimi', args: ['acp'] }),
  install: {
    darwin: INSTALL_SH,
    linux: INSTALL_SH,
    win32: 'Invoke-RestMethod https://code.kimi.com/install.ps1 | Invoke-Expression'
  }
})
