import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import type { Provider } from '../src/runner/providers/types'
import { agentId } from '../src/shared/llm'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

describe('goal runs', () => {
  let host: TestHost
  let runner: Runner
  let ui: TestUi

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    ui?.close()
    runner?.close()
    await host.close()
  })

  it('starts a fresh goal run from chat or a live thread', async () => {
    const goals: boolean[] = []
    let steers = 0
    const provider: Provider = {
      name: 'watcher',
      label: 'Watcher',
      steerable: true,
      fields: () => [],
      detect: async () => true,
      start: (_prompt, _cwd, _hooks, _settings, options) => ({
        done: new Promise(resolve => setTimeout(() => resolve({ text: 'done' }), 180)),
        kill: () => {},
        steer: () => {
          steers += 1
          return true
        }
      })
    }
    const originalStart = provider.start
    provider.start = (prompt, cwd, hooks, settings, options) => {
      goals.push(options?.goal === true)
      return originalStart(prompt, cwd, hooks, settings, options)
    }
    runner = testRunner({ name: 'sam', code: host.code, repoPath: host.repoPath, providers: [provider] })
    runner.connect(host.url)
    ui = await TestUi.connect(host.url, 'sam', host.code)
    await ui.waitForEvent(event => event.kind === 'agent.online')

    const watcher = agentId('sam', 'watcher')
    ui.chat('start the migration @Watcher', [watcher])
    const thread = await ui.waitForEvent(event => event.kind === 'thread.started')
    if (thread.kind !== 'thread.started') throw new Error('The thread did not start.')
    await ui.waitForEvent(event => event.kind === 'agent.start' && event.threadId === thread.threadId)

    ui.chat('finish the migration', [], thread.threadId, ['goal'])
    const goalStart = await ui.waitForEvent(
      event => event.kind === 'agent.start' && event.threadId === thread.threadId && event.promptText === 'finish the migration'
    )
    expect(goalStart.kind).toBe('agent.start')
    expect(goals).toEqual([false, true])
    expect(steers).toBe(0)

    await ui.waitForEvent(event => event.kind === 'agent.end' && event.promptId === goalStart.promptId)
    ui.chat('verify it @Watcher', [watcher], undefined, ['goal'])
    const chatGoal = await ui.waitForEvent(
      event => event.kind === 'agent.start' && event.threadId !== thread.threadId && event.promptText === 'verify it @Watcher'
    )
    expect(chatGoal.kind).toBe('agent.start')
    expect(goals).toEqual([false, true, true])
  })
})
