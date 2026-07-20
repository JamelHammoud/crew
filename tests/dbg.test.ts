import { describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { agentId } from '../src/shared/llm'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir } from './helpers/session'

describe('dbg', () => {
  it('plain folder', async () => {
    const host = await startHost(tmpDir('dbg-host'))
    const runner = new Runner({
      name: 'jamel', code: host.code, repoPath: tmpDir('dbg-plain'),
      providers: [makeFakeProvider()], reconnectDelayMs: 100, autoPullMs: 200
    })
    runner.connect(host.url)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    await ui.waitForEvent(e => e.kind === 'agent.online', 5000)
    console.log('ONLINE OK')
    ui.chat('hello @Fake', [agentId('jamel', 'fake')])
    try {
      const end = await ui.waitForEvent(e => e.kind === 'agent.end', 5000)
      console.log('END', JSON.stringify(end))
    } catch (e) {
      console.log('NO END. events:', JSON.stringify(ui.events.map(x => x.kind)))
      console.log('messages:', JSON.stringify(ui.messages.map(m => m.type)))
    }
    runner.close(); ui.close(); await host.close()
    expect(true).toBe(true)
  }, 30000)
})
