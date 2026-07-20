import { fileURLToPath } from 'node:url'
import type { AgentSettingField } from '../../src/shared/llm'
import { choices, flag, makeCliProvider } from '../../src/runner/providers/cli'
import type { OutputParser, Provider } from '../../src/runner/providers/types'

export const fakeCliPath = fileURLToPath(new URL('./fake-cli.mjs', import.meta.url))
export const fakeSteerCliPath = fileURLToPath(new URL('./fake-steer-cli.mjs', import.meta.url))

export const parseFakeLine: OutputParser = line => {
  if (line.startsWith('TEXT ')) return [{ text: line.slice(5) }]
  if (line.startsWith('THINK ')) return [{ thinking: line.slice(6) }]
  if (line.startsWith('ACT ')) {
    const [, id, kind, ...rest] = line.split(' ')
    return [
      {
        activity: {
          id,
          kind: kind === 'subagent' ? ('subagent' as const) : ('tool' as const),
          name: rest[0] ?? '',
          status: 'started' as const,
          detail: rest.slice(1).join(' ') || undefined
        }
      }
    ]
  }
  if (line.startsWith('END ')) {
    return [{ activity: { id: line.slice(4), kind: 'tool' as const, name: '', status: 'finished' as const } }]
  }
  return []
}

export const fakeFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', 'small', 'large']), default: '' }
]

export function makeFakeProvider(env: NodeJS.ProcessEnv = {}, name = 'fake', label = 'Fake'): Provider {
  return makeCliProvider({
    name,
    label,
    command: process.execPath,
    fields: fakeFields,
    args: (prompt, get) => [fakeCliPath, prompt, ...flag('--model', get('model'))],
    parser: parseFakeLine,
    env
  })
}
