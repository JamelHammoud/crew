import { goalBrief, goalCondition } from '../../shared/goal'
import { resolveSettings, type AgentSettingField } from '../../shared/llm'
import {
  serverName,
  serverProviderName,
  serverUrl,
  type ModelServer
} from '../../shared/modelServers'
import { commandExists } from './cli'
import type { Tuning } from './local-chat'
import { startLoop, type LocalRun } from './local-loop'
import { localModels, modelsServedOn, refreshModels } from './local-models'
import {
  cachedRuntimes,
  cachedServer,
  candidateUrls,
  ensureServing,
  findRuntimes,
  findServer,
  probeServer
} from './local-serve'
import { knownServers, serverKey } from './local-servers'
import { makeSink } from './run'
import type { Provider, RunningPrompt, RunOptions } from './types'

const CONTEXT_SIZES: Array<[string, string]> = [
  ['', 'Default'],
  ['8192', '8K'],
  ['16384', '16K'],
  ['32768', '32K'],
  ['65536', '64K']
]

const modelField = (models: string[]): AgentSettingField => ({
  key: 'model',
  label: 'Model',
  options: models.map(model => ({ value: model, label: model })),
  default: models[0] ?? ''
})

const contextField = (): AgentSettingField => ({
  key: 'context',
  label: 'Context',
  options: CONTEXT_SIZES.map(([value, label]) => ({ value, label })),
  default: ''
})

const THINKING = [
  { value: 'on', label: 'On' },
  { value: 'max', label: 'Max' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'off', label: 'Off' }
]

const KEEP_ALIVE = [
  { value: '', label: 'Default' },
  { value: '30m', label: '30 minutes' },
  { value: '2h', label: '2 hours' },
  { value: '-1', label: 'Always' },
  { value: '0', label: 'Never' }
]

const tuningFields = (): AgentSettingField[] => [
  { key: 'thinking', label: 'Thinking', options: THINKING, default: 'on', advanced: true, section: 'Thinking' },
  {
    key: 'temperature',
    label: 'Temperature',
    kind: 'number',
    default: '',
    advanced: true,
    section: 'Answers',
    min: 0,
    max: 2,
    step: 0.1,
    line: 'Lower is steadier, higher is looser.'
  },
  {
    key: 'topP',
    label: 'Top P',
    kind: 'number',
    default: '',
    advanced: true,
    section: 'Answers',
    min: 0,
    max: 1,
    step: 0.05
  },
  {
    key: 'seed',
    label: 'Seed',
    kind: 'number',
    default: '',
    advanced: true,
    section: 'Answers',
    line: 'The same question comes back with the same answer.'
  },
  {
    key: 'maxReply',
    label: 'Longest reply',
    kind: 'number',
    default: '',
    advanced: true,
    section: 'Answers',
    min: 64,
    unit: 'tokens'
  },
  {
    key: 'keepAlive',
    label: 'Stays in memory',
    options: KEEP_ALIVE,
    default: '',
    advanced: true,
    section: 'On this computer',
    line: 'Longer means the next message is answered straight away.'
  }
]

export const localTuning = (get: (key: string) => string): Tuning => ({
  think: get('thinking'),
  temperature: get('temperature'),
  topP: get('topP'),
  seed: get('seed'),
  maxReply: get('maxReply'),
  keepAlive: get('keepAlive')
})

export const localFields = (): AgentSettingField[] => {
  const runtimes = cachedRuntimes()
  return [
    {
      key: 'address',
      label: 'Server',
      options: runtimes.map(runtime => ({ value: runtime.url, label: runtime.label })),
      default: runtimes[0]?.url ?? '',
      free: true
    },
    modelField(localModels()),
    contextField(),
    ...tuningFields()
  ]
}

export const serverFields = (url: string): AgentSettingField[] => [
  modelField(modelsServedOn([url])),
  contextField(),
  ...tuningFields()
]

const OLLAMA_INSTALL_SH = 'curl -fsSL https://ollama.com/install.sh | sh'

interface RunOn {
  fields: AgentSettingField[]
  address(resolved: Record<string, string>): string
  models(): string[]
}

// The loop is the same wherever it sends its rounds, so what a provider hands
// over is the address and the models it may pick from, and nothing else.
function runOn(
  on: RunOn,
  prompt: string,
  cwd: string,
  hooks: Parameters<Provider['start']>[2],
  settings: Record<string, string>,
  options: RunOptions
): RunningPrompt {
  const resolved = resolveSettings(on.fields, settings)
  const sink = makeSink(cwd, hooks)
  const body = options.goal ? `${goalBrief(goalCondition(options.goal))}\n\n${prompt}` : prompt
  const early: string[] = []
  let run: LocalRun | null = null
  let stopped = false

  const done = (async () => {
    const url = on.address(resolved)
    // A server that was up when the picker was drawn can be down by the time
    // somebody says something, so the address is asked again here, and only
    // a silent one is started. The key is read off this machine rather than
    // off the settings, which the whole crew can see.
    const key = serverKey(url)
    let probe = await probeServer(url, key)
    if (!probe.runtime && (await ensureServing(url))) probe = await probeServer(url, key)
    const runtime = probe.runtime
    if (!runtime) throw new Error(probe.why ?? `Nothing answered at ${url}.`)
    const model = settings['model'] || resolved.model || on.models()[0]
    if (!model) throw new Error('No model to run. Pull one and say that again.')
    if (stopped) throw new Error('Stopped')
    const started = startLoop({
      runtime,
      model,
      context: Number(resolved.context) || 0,
      cwd,
      prompt: body,
      sink,
      tuning: localTuning(field => resolved[field] ?? '')
    })
    run = started
    for (const text of early) started.say(text)
    early.length = 0
    return started.done
  })()

  return {
    done,
    kill: () => {
      stopped = true
      run?.kill()
    },
    steer: (text: string) => {
      if (stopped) return false
      if (run) return run.say(text)
      early.push(text)
      return true
    }
  }
}

// A server somebody wrote down stands in the picker under the name they gave
// it, beside Claude and Ollama rather than inside one of them. The address is
// what it is written down as, so a rename never orphans the agents made on it.
export function serverProvider(server: ModelServer): Provider {
  const url = server.url
  return {
    name: serverProviderName(url),
    label: serverName(server),
    steerable: true,
    fields: () => serverFields(url),
    detect: async () => {
      const runtime = await findServer(server)
      if (runtime) await refreshModels([runtime])
      return runtime !== null
    },
    note: async () => {
      if (!cachedServer(url)) return undefined
      return modelsServedOn([url]).length > 0 ? undefined : 'No models on that server yet.'
    },
    start: (prompt, cwd, hooks, settings = {}, options = {}) =>
      runOn(
        { fields: serverFields(url), address: () => url, models: () => modelsServedOn([url]) },
        prompt,
        cwd,
        hooks,
        settings,
        options
      )
  }
}

export const serverProviders = (): Provider[] => knownServers().map(serverProvider)

export const serverProviderNamed = (name: string): Provider | null => {
  const server = knownServers().find(one => serverProviderName(one.url) === name)
  return server ? serverProvider(server) : null
}

export const localProvider: Provider = {
  name: 'local',
  label: 'Ollama',
  steerable: true,
  fields: localFields,
  install: {
    darwin: 'brew install ollama',
    linux: OLLAMA_INSTALL_SH,
    win32: 'winget install --id Ollama.Ollama --accept-package-agreements --accept-source-agreements'
  },
  detect: async () => {
    const found = await findRuntimes()
    await refreshModels(found)
    return found.length > 0 || commandExists('ollama')
  },
  // The one state an agent can be made in and fail on its first word: a machine
  // that can run models and has none. A server that is installed and not
  // running is not one of them, since start() puts it up.
  note: async () => {
    if (localModels().length > 0) return undefined
    const runtimes = cachedRuntimes()
    if (runtimes.some(runtime => runtime.kind === 'ollama') || commandExists('ollama')) {
      return 'No models on this computer yet. Pull one with ollama pull.'
    }
    if (runtimes.length > 0) return `No models on this computer yet. Download one in ${runtimes[0].label}.`
    return undefined
  },
  start: (prompt, cwd, hooks, settings = {}, options = {}): RunningPrompt =>
    runOn(
      {
        fields: localFields(),
        // What somebody picked beats what the picker can vouch for right now. A
        // list warmed in one place and read in another can be cold, and
        // resolveSettings drops a choice its options do not carry, which would
        // quietly send a run to a different server than the one it was made for.
        address: resolved =>
          serverUrl(settings['address'] || resolved.address || candidateUrls()[0]) ?? '',
        models: localModels
      },
      prompt,
      cwd,
      hooks,
      settings,
      options
    )
}
