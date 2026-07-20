import { describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { Runner } from '../src/runner'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import { createCrewServer } from '../src/server/index'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir } from './helpers/session'

describe('handoff', () => {
  it('a new host resumes the session with history and pool intact', async () => {
    const repoPath = tmpDir('handoff')
    const hostA = await startHost(repoPath)

    const ui = await TestUi.connect(hostA.url, 'sam', hostA.code)
    const runner = new Runner({
      name: 'jamel',
      code: hostA.code,
      repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100
    })
    runner.connect(hostA.url)
    await ui.waitForEvent(e => e.kind === 'agent.online')
    ui.chat('handoff note @Fake', [agentId('jamel', 'fake')])
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.ok)

    const code = hostA.code
    runner.close()
    ui.close()
    await hostA.close()

    const storeB = new Store(repoPath)
    const sessionB = new CrewSession(storeB)
    expect(sessionB.code).toBe(code)

    const serverB = await createCrewServer(sessionB, { port: 0, host: '127.0.0.1' })
    const urlB = `ws://127.0.0.1:${serverB.port()}/ws`
    const ui2 = await TestUi.connect(urlB, 'sam', code)
    const welcome = ui2.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>

    const messageTexts = welcome.snapshot.events
      .filter((e): e is Extract<import('../src/shared/events').SessionEvent, { kind: 'message' }> => e.kind === 'message')
      .map(e => e.text)
    expect(messageTexts).toContain('handoff note @Fake')

    const reply = welcome.snapshot.events.find(
      (e): e is Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }> => e.kind === 'agent.end'
    )
    expect(reply?.text).toContain('handoff note @Fake')

    const fake = welcome.snapshot.agents.find(a => a.id === agentId('jamel', 'fake'))
    expect(fake).toBeTruthy()
    expect(fake?.status).toBe('offline')

    const runnerB = new Runner({
      name: 'jamel',
      code,
      repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100
    })
    runnerB.connect(urlB)
    await ui2.waitForEvent(e => e.kind === 'agent.online')
    ui2.chat('still here @Fake', [agentId('jamel', 'fake')])
    const end = (await ui2.waitForEvent(e => e.kind === 'agent.end' && e.ok)) as Extract<
      import('../src/shared/events').SessionEvent,
      { kind: 'agent.end' }
    >
    expect(end.text).toContain('still here @Fake')

    runnerB.close()
    ui2.close()
    await serverB.close()
  })

  it('keeps docs across handoff', async () => {
    const repoPath = tmpDir('handoff-docs')
    const hostA = await startHost(repoPath)
    const ui = await TestUi.connect(hostA.url, 'sam', hostA.code)
    ui.send({ type: 'doc.update', page: 'main', text: '# Plan\n\nBuild crew.' })
    await new Promise(r => setTimeout(r, 200))
    ui.close()
    await hostA.close()

    const storeB = new Store(repoPath)
    expect(storeB.loadDocs().main).toBe('# Plan\n\nBuild crew.')
  })
})
