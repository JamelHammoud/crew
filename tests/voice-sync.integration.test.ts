import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { agentId } from '../src/shared/llm'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'agent.start' }>

describe('a spoken turn and the sync pass in front of it', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []
  let release: (() => void) | null = null
  let passes = 0

  beforeEach(async () => {
    host = await startHost()
    passes = 0
    release = null
  })

  afterEach(async () => {
    release?.()
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  // A pass that never settles until the test lets it, which is what a real one
  // queued behind another machine's commit and push looks like from here.
  const held = () =>
    new Promise<void>(resolve => {
      passes++
      release = resolve
    })

  async function connect(name: string) {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100,
      onBeforeRun: held
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })
    return runner
  }

  async function ui(name: string) {
    const one = await TestUi.connect(host.url, name, host.code)
    uis.push(one)
    return one
  }

  const startsSeen = (one: TestUi) => one.events.filter(event => event.kind === 'agent.start') as Started[]

  it('says its first word without waiting for the pass to settle', async () => {
    const sam = await ui('sam')
    await connect('mac')
    await sam.waitForEvent(e => e.kind === 'agent.online')
    const fake = agentId('mac', 'fake')

    sam.chat('what is in this project', [fake], undefined, ['voice'])

    await waitUntil(() => startsSeen(sam).length === 1)
    expect(passes).toBe(1)
    expect(release).not.toBeNull()
  })

  it('still holds a typed turn behind it', async () => {
    const sam = await ui('sam')
    await connect('mac')
    await sam.waitForEvent(e => e.kind === 'agent.online')
    const fake = agentId('mac', 'fake')

    sam.chat('what is in this project', [fake])

    await waitUntil(() => passes === 1)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(startsSeen(sam)).toHaveLength(0)

    release?.()
    await waitUntil(() => startsSeen(sam).length === 1)
  })
})
