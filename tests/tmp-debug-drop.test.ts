import { afterEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

describe('debug drop', () => {
  let host: TestHost
  let runner: Runner | null = null
  let ui: TestUi | null = null

  afterEach(async () => {
    ui?.close()
    runner?.close()
    await host.close()
  })

  it('traces the drop', async () => {
    host = await startHost()
    ui = await TestUi.connect(host.url, 'sam', host.code)
    runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '500' })],
      reconnectDelayMs: 100
    })
    runner.onStatus = s => console.log('RUNNER STATUS', s, Date.now() % 100000)
    runner.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('slow @Fake', [agentId('jamel', 'fake')])
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    console.log('STARTED', start.promptId)
    runner.dropConnection()

    const timeline: string[] = []
    const seen = new Promise<void>(resolve => {
      const orig = ui!.events.push.bind(ui!.events)
      setInterval(() => {}, 100)
      resolve()
    })
    void seen
    void timeline

    await new Promise(r => setTimeout(r, 4000))
    console.log(
      'EVENTS',
      ui.events.map(e => `${e.kind}${e.kind === 'agent.end' ? `:${e.ok}:${(e as any).error ?? ''}` : ''}`)
    )
    const end = ui.events.find(e => e.kind === 'agent.end' && (e as any).promptId === start.promptId)
    expect(end).toBeTruthy()
  }, 20000)
})
