import { resolveSettings, type AgentSettingField } from '../../shared/llm'
import { commandExists } from './cli'
import { startLoop, type LocalRun } from './local-loop'
import { cachedModels, refreshModels } from './local-models'
import { answering, cachedRuntimes, candidateUrls, ensureServing, findRuntimes } from './local-serve'
import { makeSink } from './run'
import type { Provider, RunningPrompt } from './types'

const CONTEXT_SIZES: Array<[string, string]> = [
  ['', 'Default'],
  ['8192', '8K'],
  ['16384', '16K'],
  ['32768', '32K'],
  ['65536', '64K']
]

const PLAN_BRIEF =
  'Work out how you would do this and say so. Read whatever you need to read, and change nothing: no Write, no Edit, no command that writes.'

export const localFields = (): AgentSettingField[] => {
  const runtimes = cachedRuntimes()
  const models = cachedModels()
  return [
    {
      key: 'address',
      label: 'Server',
      options: runtimes.map(runtime => ({ value: runtime.url, label: runtime.label })),
      default: runtimes[0]?.url ?? ''
    },
    {
      key: 'model',
      label: 'Model',
      options: models.map(model => ({ value: model, label: model })),
      default: models[0] ?? ''
    },
    {
      key: 'context',
      label: 'Context',
      options: CONTEXT_SIZES.map(([value, label]) => ({ value, label })),
      default: ''
    }
  ]
}

const OLLAMA_INSTALL_SH = 'curl -fsSL https://ollama.com/install.sh | sh'

// Every model server on this machine speaks the same two shapes, so the
// provider is Local rather than Ollama and the address is whichever one
// answered. Ollama is the default and the one Install installs, which is what
// gets somebody with nothing on their machine to a working agent in one press.
export const localProvider: Provider = {
  name: 'local',
  label: 'Local',
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
  note: async () => {
    if (cachedModels().length > 0) return undefined
    return cachedRuntimes().length > 0
      ? 'No models here yet. Pull one with ollama pull, then open this again.'
      : 'Nothing is serving models on this computer. Start Ollama, then open this again.'
  },
  start: (prompt, cwd, hooks, settings = {}, options = {}): RunningPrompt => {
    const resolved = resolveSettings(localFields(), settings)
    const sink = makeSink(cwd, hooks)
    const body = options.goal ? `${prompt}\n\n${PLAN_BRIEF}` : prompt
    const early: string[] = []
    let run: LocalRun | null = null
    let stopped = false

    const done = (async () => {
      const url = resolved.address || candidateUrls()[0]
      // A server that was up when the picker was drawn can be down by the time
      // somebody says something, so the address is asked again here, and only
      // a silent one is started.
      let runtime = await answering(url)
      if (!runtime) {
        await ensureServing(url)
        runtime = await answering(url)
      }
      if (!runtime) throw new Error('Nothing answered at that address. Start the model server and say it again.')
      const model = resolved.model || cachedModels()[0]
      if (!model) throw new Error('There is no model on this computer to run. Pull one and say it again.')
      if (stopped) throw new Error('Stopped')
      const started = startLoop({
        runtime,
        model,
        context: Number(resolved.context) || 0,
        cwd,
        prompt: body,
        sink
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
}
