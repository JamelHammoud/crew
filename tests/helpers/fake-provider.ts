import { fileURLToPath } from 'node:url'
import type { AgentSettingField } from '../../src/shared/llm'
import { choices, flag, makeCliProvider } from '../../src/runner/providers/cli'
import type { OutputParser, Provider } from '../../src/runner/providers/types'

export const fakeCliPath = fileURLToPath(new URL('./fake-cli.mjs', import.meta.url))
export const fakeSteerCliPath = fileURLToPath(new URL('./fake-steer-cli.mjs', import.meta.url))

const delta = (rest: string): { index: number; text: string } => {
  const space = rest.indexOf(' ')
  return { index: Number(rest.slice(0, space)), text: rest.slice(space + 1) }
}

export const parseFakeLine: OutputParser = line => {
  if (line.startsWith('TEXT ')) return [{ text: line.slice(5) }]
  if (line.startsWith('THINK ')) return [{ thinking: line.slice(6) }]
  if (line.startsWith('THINKSTART ')) return [{ thinkingStart: { index: Number(line.slice(11)) } }]
  if (line.startsWith('TEXTSTART ')) return [{ textStart: { index: Number(line.slice(10)) } }]
  if (line.startsWith('BLOCKSTOP ')) return [{ blockStop: { index: Number(line.slice(10)) } }]
  if (line.startsWith('THINKDELTA ')) return [{ thinkingDelta: delta(line.slice(11)) }]
  if (line.startsWith('TEXTDELTA ')) return [{ textDelta: delta(line.slice(10)) }]
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
  // What one call of the model cost, and what the whole turn came to. A CLI
  // reports the parts as it goes and the total at the end, so the fake does too.
  if (line.startsWith('USAGE ') || line.startsWith('TOTAL ')) {
    const total = line.startsWith('TOTAL ')
    const [model, input, output, cacheRead, cacheWrite, cost] = line.slice(6).split(' ')
    return [
      {
        usage: {
          model,
          input: Number(input),
          output: Number(output),
          cacheRead: Number(cacheRead),
          cacheWrite: Number(cacheWrite),
          cost: cost === undefined ? undefined : Number(cost),
          total: total || undefined
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
