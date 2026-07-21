import { afterEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import type { SessionEvent } from '../src/shared/events'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

describe('connection health', () => {
  let host: TestHost | null = null
  let uis: TestUi[] = []
  let runners: Runner[] = []

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host?.close()
    host = null
  })

  it('keeps quiet connections alive across heartbeat intervals', async () => {
    host = await startHost(undefined, { heartbeatMs: 100 })
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)

    await new Promise(r => setTimeout(r, 600))

    ui.chat('still here?')
    const echo = (await ui.waitForEvent(e => e.kind === 'message' && e.text === 'still here?')) as Extract<
      SessionEvent,
      { kind: 'message' }
    >
    expect(echo.text).toBe('still here?')
  })

  it('terminates a client that stops answering', async () => {
    const live = await startHost(undefined, { heartbeatMs: 100 })
    host = live
    const ui = await TestUi.connect(live.url, 'sam', live.code)
    uis.push(ui)

    ui.pauseTransport()
    await waitUntil(() => live.session.snapshot().members.some(m => m.name === 'sam' && !m.connected), 5000)
    ui.resumeTransport()
    await ui.waitForClose(5000)

    const fresh = await TestUi.connect(live.url, 'sam', live.code)
    uis.push(fresh)
    expect(fresh.selfId).toBeTruthy()
  })

  it('runner heals itself when the host goes silent', async () => {
    host = await startHost(undefined, { heartbeatMs: 60000, autoPong: false })
    const statuses: string[] = []
    const runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100,
      silenceTimeoutMs: 400
    })
    runner.onStatus = status => statuses.push(status)
    runners.push(runner)
    runner.connect(host.url)

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`never healed: ${statuses.join(',')}`)), 10000)
      const check = () => {
        const firstOffline = statuses.indexOf('offline')
        if (firstOffline !== -1 && statuses.slice(firstOffline).includes('online')) {
          clearTimeout(timer)
          resolve()
        } else {
          setTimeout(check, 50)
        }
      }
      check()
    })
  }, 15000)
})
