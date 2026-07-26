import { fileURLToPath } from 'node:url'
import type { AgentSettingField } from '../../src/shared/llm'
import { choices, flag, makeCliProvider } from '../../src/runner/providers/cli'
import type { OutputParser, Provider } from '../../src/runner/providers/types'

export const fakeCliPath = fileURLToPath(new URL('./fake-cli.mjs', import.meta.url))
export const fakeSteerCliPath = fileURLToPath(new URL('./fake-steer-cli.mjs', import.meta.url))

export const parseFakeLine: OutputParser = line => {
  if (line.startsWith('TEXT ')) return [{ text: line.slice(5) }]
  if (line.startsWith('THINK ')) return [{ thinking: line.slice(6) }]
  if (line.startsWith('THINKSTART ')) return [{ thinkingStart: { index: Number(line.slice(11)) } }]
  if (line.startsWith('THINKSTOP ')) return [{ thinkingStop: { index: Number(line.slice(10)) } }]
  if (line.startsWith('THINKDELTA ')) {
    const rest = line.slice(11)
    const space = rest.indexOf(' ')
    return [{ thinkingDelta: { index: Number(rest.slice(0, space)), text: rest.slice(space + 1) } }]
  }
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
  // A result arrives without the name it was called under, the way every real
  // CLI reports one.
  if (line.startsWith('OUT ')) {
    const [, id, ...rest] = line.split(' ')
    return [
      {
        activity: {
          id,
          kind: 'tool' as const,
          name: '',
          status: 'finished' as const,
          output: rest.join(' ')
        }
      }
    ]
  }
  if (line === 'RESULT') return [{ turnEnd: true }]
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

export function makeSteerableProvider(env: NodeJS.ProcessEnv = {}, name = 'steery', label = 'Steery'): Provider {
  return makeCliProvider({
    name,
    label,
    command: process.execPath,
    fields: fakeFields,
    args: () => [fakeSteerCliPath],
    parser: parseFakeLine,
    streamInput: true,
    env
  })
}
