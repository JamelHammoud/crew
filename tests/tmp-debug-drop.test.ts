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
    const provider = makeFakeProvider({ FAKE_CLI_DELAY_MS: '500' })
    const origStart = provider.start
    provider.start = (prompt, cwd, hooks, settings) => {
      console.log('SPAWN', Date.now() % 100000)
      const run = origStart(prompt, cwd, hooks, settings)
      run.done.then(
        r => console.log('DONE', Date.now() % 100000, r.text.slice(0, 40)),
        err => console.log('ERR', Date.now() % 100000, String(err))
      )
      const origKill = run.kill
      run.kill = () => {
        console.log('KILLED', Date.now() % 100000, new Error('kill').stack?.split('\n').slice(2, 6).join(' <- '))
        origKill()
      }
      return run
    }
    runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [provider],
      reconnectDelayMs: 100
    })
    const origSend = (runner as any).send.bind(runner)
    ;(runner as any).send = (msg: any) => {
      console.log('OUT', Date.now() % 100000, msg.type)
      origSend(msg)
    }
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
      ui.events.map(e => `${e.kind}${e.kind === 'agent.end' ? `:${e.ok}:${(e as any).error ?? ''}` : ''}`).join(' | ')
    )
    const r = runner as any
    console.log('RUNNER running:', r.running.size, 'outbox:', r.outbox.length, 'tails:', r.tails.size)
    console.log('STEPS', ui.steps.map(s => `${s.step.kind}:${s.step.status}:${s.step.text ?? ''}`).join(' | '))
    const end = ui.events.find(e => e.kind === 'agent.end' && (e as any).promptId === start.promptId)
    expect(end).toBeTruthy()
  }, 20000)
})
