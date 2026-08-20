import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { agentId } from '../src/shared/llm'
import type { CrewPlugin } from '../src/shared/plugins'
import { pluginPreamble } from '../src/shared/pluginPreamble'
import type { RegisteredLlm, ServerMessage } from '../src/shared/protocol'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Prompt = Extract<ServerMessage, { type: 'prompt' }>

const FAKE: RegisteredLlm = { instanceId: 'fake', provider: 'fake', label: 'Fake', fields: [], settings: {} }

const held = (name: string): CrewPlugin => ({ id: name, catalogId: name, name, by: 'sam', ts: 1 })

interface FakeRunner {
  ws: WebSocket
  messages: ServerMessage[]
}

async function runnerOn(host: TestHost): Promise<FakeRunner> {
  const ws = new WebSocket(host.url)
  const runner: FakeRunner = { ws, messages: [] }
  ws.on('message', raw => runner.messages.push(JSON.parse(raw.toString()) as ServerMessage))
  await new Promise<void>((resolve, reject) => {
    ws.on('error', reject)
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'mac', code: host.code, llms: [FAKE] }))
      resolve()
    })
  })
  return runner
}

describe('a plugin put on one message', () => {
  let host: TestHost
  let uis: TestUi[] = []
  let runners: FakeRunner[] = []

  const opened = async (): Promise<{ sam: TestUi; runner: FakeRunner }> => {
    const runner = await runnerOn(host)
    runners.push(runner)
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await waitUntil(() => host.session.snapshot().agents.length > 0)
    sam.send({ type: 'plugin.add', plugin: { name: 'frontpages' } } as never)
    await sam.waitForEvent(e => e.kind === 'plugin.added')
    return { sam, runner }
  }

  const promptOf = async (runner: FakeRunner): Promise<Prompt> => {
    await waitUntil(() => runner.messages.some(m => m.type === 'prompt'))
    return runner.messages.find(m => m.type === 'prompt') as Prompt
  }

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.ws.close()
    uis = []
    runners = []
    await host.close()
  })

  it('reaches the run it was sent with', async () => {
    const { sam, runner } = await opened()

    sam.chat('draw the landing page', [agentId('mac', 'fake')], undefined, undefined, 'frontpages')

    expect((await promptOf(runner)).usePlugin).toBe('frontpages')
  })

  // A name nothing answers to is nothing, the way naming an agent who is not
  // here is, rather than a run told to reach for a plugin the crew has not got.
  it('is nothing when the crew does not hold it', async () => {
    const { sam, runner } = await opened()

    sam.chat('draw the landing page', [agentId('mac', 'fake')], undefined, undefined, 'raylight')

    expect((await promptOf(runner)).usePlugin).toBeUndefined()
  })

  it('names it in the words the machine writes, and says nothing without one', () => {
    const plugins = [held('frontpages')]
    const said = pluginPreamble('http://127.0.0.1:1/x', 'p1', plugins, true, 'frontpages')

    expect(said).toContain('Frontpages')
    expect(pluginPreamble('http://127.0.0.1:1/x', 'p1', plugins, true)).toBe('')
    expect(pluginPreamble('http://127.0.0.1:1/x', 'p1', plugins, false, 'frontpages')).toBe('')
    expect(pluginPreamble('http://127.0.0.1:1/x', 'p1', [held('raylight')], true)).toBe('')
  })
})
