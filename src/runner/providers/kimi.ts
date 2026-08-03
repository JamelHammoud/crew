import type { AgentSettingField } from '../../shared/llm'
import { choices, makeCliProvider } from './cli'
import { kimiDialog, kimiParser } from './kimi-acp'
import { kimiModels } from './kimi-models'
import type { Provider } from './types'

export const kimiFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', ...kimiModels()]), default: '' }
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
  dialog: (prompt, cwd, get) => kimiDialog(prompt, cwd, get),
  steerable: true,
  install: {
    darwin: INSTALL_SH,
    linux: INSTALL_SH,
    win32: 'Invoke-RestMethod https://code.kimi.com/install.ps1 | Invoke-Expression'
  }
})
