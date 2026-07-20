import { makeCliProvider } from './cli'
import type { Provider } from './types'

export const codexProvider: Provider = makeCliProvider({
  name: 'codex',
  label: 'Codex',
  command: 'codex',
  args: prompt => ['exec', '--full-auto', prompt]
})
