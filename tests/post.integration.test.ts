import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { SYSTEM_AUTHOR_ID, type SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { POST_INSTRUCTIONS } from '../src/shared/post'
import type { RegisteredLlm, ServerMessage } from '../src/shared/protocol'
import type { ToolAction } from '../src/shared/toolbox'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'

type Prompt = Extract<ServerMessage, { type: 'prompt' }>
type Notice = Extract<ServerMessage, { type: 'notice' }>
type Message = Extract<SessionEvent, { kind: 'message' }>

const SCHEDULE_ID = 'aaa111'
const SAID = 'Two files moved this week and the tests still pass.'
const FAKE: RegisteredLlm = { instanceId: 'fake', provider: 'fake', label: 'Fake', fields: [], settings: {} }
const GONE: RegisteredLlm = { instanceId: 'gone', provider: 'fake', label: 'Gone', fields: [], settings: {} }

const settle = () => new Promise(r => setTimeout(r, 300))

const RUN_KINDS = new Set(['agent.start', 'agent.step', 'agent.end'])

const messagesIn = (events: SessionEvent[]): Message[] =>
  events.filter((event): event is Message => event.kind === 'message')

function sleptWith(action: ToolAction, opts: { paused?: boolean } = {}): string {
  const path = tmpDir('posted')
  const store = new Store(path)
  store.appendEvent({
    id: randomUUID(),
    ts: Date.now() - 7 * 24 * 60 * 60 * 1000,
    kind: 'schedule.added',
    scheduleId: SCHEDULE_ID,
    name: 'Standup',
    mark: 'clock',
    when: { kind: 'daily', at: 9 * 60 },
    action,
    zone: 'Europe/Lisbon',
    byName: 'sam'
  })
  if (opts.paused) {
    store.appendEvent({
      id: randomUUID(),
      ts: Date.now() - 6 * 24 * 60 * 60 * 1000,
      kind: 'schedule.paused',
      scheduleId: SCHEDULE_ID,
      paused: true,
      byName: 'sam'
    })
  }
  return path
}

interface FakeRunner {
  ws: WebSocket
  messages: ServerMessage[]
  prompts: Prompt[]
  reply: ((prompt: Prompt) => void) | null
}

describe('a line an agent posts in the chat', () => {
  let hosts: TestHost[] = []
  let uis: TestUi[] = []
  let runners: FakeRunner[] = []

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.ws.close()
    uis = []
    runners = []
    for (const host of hosts) await host.close()
    hosts = []
  })

  async function open(repoPath?: string): Promise<TestHost> {
    const host = await startHost(repoPath)
    hosts.push(host)
    return host
  }

  async function connectUi(host: TestHost, name: string): Promise<TestUi> {
    const ui = await TestUi.connect(host.url, name, host.code)
    uis.push(ui)
    return ui
  }

  async function runnerOn(host: TestHost, name: string, llms: RegisteredLlm[] = [FAKE]): Promise<FakeRunner> {
    const ws = new WebSocket(host.url)
    const runner: FakeRunner = { ws, messages: [], prompts: [], reply: null }
    ws.on('message', raw => {
      const msg = JSON.parse(raw.toString()) as ServerMessage
      runner.messages.push(msg)
      if (msg.type !== 'prompt') return
      runner.prompts.push(msg)
      runner.reply?.(msg)
    })
    await new Promise<void>((resolve, reject) => {
      ws.on('error', reject)
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'hello', role: 'runner', name, code: host.code, llms }))
        resolve()
      })
    })
    runners.push(runner)
    await waitUntil(() => host.session.snapshot().agents.length >= llms.length)
    return runner
  }

  const works = (runner: FakeRunner, text: string): void => {
    runner.reply = prompt => {
      runner.ws.send(
        JSON.stringify({
          type: 'agent.step',
          promptId: prompt.promptId,
          step: { id: 'step-1', kind: 'tool', status: 'running', name: 'Read', detail: 'notes.txt' }
        })
      )
      runner.ws.send(JSON.stringify({ type: 'agent.done', promptId: prompt.promptId, text }))
    }
  }

  const fails = (runner: FakeRunner, message: string): void => {
    runner.reply = prompt => {
      runner.ws.send(JSON.stringify({ type: 'agent.error', promptId: prompt.promptId, message }))
    }
  }

  async function clockStruck(): Promise<{ host: TestHost; runner: FakeRunner; sam: TestUi }> {
    const host = await open(sleptWith({ kind: 'post', text: 'Say what changed this week' }, { paused: true }))
    const runner = await runnerOn(host, 'mac')
    const sam = await connectUi(host, 'sam')
    works(runner, SAID)
    sam.send({ type: 'schedule.pause', scheduleId: SCHEDULE_ID, paused: false })
    await waitUntil(() => messagesIn(host.session.snapshot().events).some(m => m.text === SAID))
    await settle()
    return { host, runner, sam }
  }

  it("lands one message under the agent's own name and opens no thread", async () => {
    const { host, sam } = await clockStruck()
    const fake = agentId('mac', 'fake')

    const logged = host.store.loadEvents()
    expect(logged.some(event => event.kind === 'thread.started')).toBe(false)
    expect(host.session.snapshot().events.some(event => event.kind === 'thread.started')).toBe(false)
    expect(new CrewSession(host.store).snapshot().events.some(event => event.kind === 'thread.started')).toBe(false)

    const said = messagesIn(logged)
    expect(said).toHaveLength(1)
    expect(said[0].threadId).toBeUndefined()
    expect(said[0].authorId).toBe(fake)
    expect(said[0].authorName).toBe('Fake')
    expect(said[0].text).toBe(SAID)

    const heard = messagesIn(sam.events)
    expect(heard).toHaveLength(1)
    expect(heard[0]).toMatchObject({ authorId: fake, authorName: 'Fake', text: SAID })
    expect(heard[0].threadId).toBeUndefined()
  })

  it('writes down none of the work it did on the way, and shows a window none of it', async () => {
    const { host, sam } = await clockStruck()

    expect(host.store.loadEvents().filter(event => RUN_KINDS.has(event.kind))).toEqual([])
    expect(host.session.snapshot().events.filter(event => RUN_KINDS.has(event.kind))).toEqual([])
    expect(new CrewSession(host.store).snapshot().events.filter(event => RUN_KINDS.has(event.kind))).toEqual([])

    expect(sam.events.filter(event => RUN_KINDS.has(event.kind))).toEqual([])
    expect(sam.steps).toEqual([])
    expect(sam.messages.some(msg => msg.type === 'queue.state')).toBe(false)
    expect(sam.events.some(event => 'threadId' in event && event.threadId !== undefined)).toBe(false)
  })

  it('hands a window arriving mid-run no sign of it', async () => {
    const host = await open()
    const runner = await runnerOn(host, 'mac')
    const sam = await connectUi(host, 'sam')

    sam.send({ type: 'chat.post', text: 'Say what changed this week' })
    await waitUntil(() => runner.prompts.length === 1)

    const late = await connectUi(host, 'robin')
    const welcome = late.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    expect(welcome.snapshot.events.some(event => event.kind === 'thread.started')).toBe(false)
    expect(welcome.snapshot.events.filter(event => RUN_KINDS.has(event.kind))).toEqual([])
    expect(welcome.snapshot.threadEvents).toEqual([])
    expect(welcome.snapshot.threadPrompts).toEqual({})
    expect(welcome.snapshot.queues).toEqual({})
    expect(welcome.snapshot.agents).toHaveLength(1)
    expect(welcome.snapshot.agents[0].status).toBe('idle')
    expect(welcome.snapshot.agents[0].runs).toEqual({})

    works(runner, SAID)
    runner.reply?.(runner.prompts[0])
    await waitUntil(() => messagesIn(late.events).some(m => m.text === SAID))
  })

  it('goes to whoever is here when the agent it names has gone', async () => {
    const host = await open()
    const leaving = await runnerOn(host, 'mac', [GONE])
    const gone = agentId('mac', 'gone')
    leaving.ws.close()
    await waitUntil(() => host.session.snapshot().agents.some(a => a.id === gone && a.status === 'offline'))

    const runner = await runnerOn(host, 'pat')
    works(runner, SAID)
    const sam = await connectUi(host, 'sam')

    sam.send({ type: 'chat.post', text: 'Say what changed this week', agentId: gone })
    await waitUntil(() => messagesIn(host.session.snapshot().events).some(m => m.text === SAID))
    expect(runner.prompts).toHaveLength(1)

    const said = messagesIn(host.store.loadEvents())
    expect(said).toHaveLength(1)
    expect(said[0].authorId).toBe(agentId('pat', 'fake'))
    expect(said[0].authorName).toBe('Fake')
  })

  it('posts nothing and says why when nobody is here to write it', async () => {
    const host = await open()
    const sam = await connectUi(host, 'sam')

    sam.send({ type: 'chat.post', text: 'Say what changed this week' })
    const said = (await sam.waitFor(m => m.type === 'notice')) as Notice
    expect(said.text).toBe('No agent is here to write it.')
    expect(said.unsent).toBe(true)
    await settle()
    expect(messagesIn(host.store.loadEvents())).toEqual([])
    expect(host.store.loadEvents().some(event => event.kind === 'thread.started')).toBe(false)
  })

  it('comes round to nobody without throwing, and still writes the clock down', async () => {
    const host = await open(sleptWith({ kind: 'post', text: 'Say what changed this week' }))
    await waitUntil(() => (host.session.snapshot().schedules?.[0]?.lastRunAt ?? 0) > 0)
    await settle()
    expect(messagesIn(host.store.loadEvents())).toEqual([])
    expect(host.store.loadEvents().some(event => event.kind === 'thread.started')).toBe(false)
    expect(host.session.snapshot().schedules?.[0].lastThreadId).toBeUndefined()
  })

  it('leaves empty and failed posts out of the chat', async () => {
    const host = await open()
    const runner = await runnerOn(host, 'mac')
    const sam = await connectUi(host, 'sam')

    works(runner, '   ')
    sam.send({ type: 'chat.post', text: 'Say what changed this week' })
    await waitUntil(() => runner.prompts.length === 1)
    await waitUntil(() => host.session.snapshot().agents[0]?.status === 'idle')

    fails(runner, 'fake cli failed')
    sam.send({ type: 'chat.post', text: 'Say what changed again' })
    await waitUntil(() => runner.prompts.length === 2)
    await waitUntil(() => host.session.snapshot().agents[0]?.status === 'idle')
    await settle()

    const said = messagesIn(host.store.loadEvents())
    expect(said).toEqual([])
    expect(host.store.loadEvents().some(event => event.kind === 'thread.started')).toBe(false)
  })

  it('carries the brief on the prompt it hands over, where an ordinary run carries none', async () => {
    const host = await open()
    const runner = await runnerOn(host, 'mac')
    const sam = await connectUi(host, 'sam')

    works(runner, SAID)
    sam.send({ type: 'chat.post', text: 'Say what changed this week' })
    await waitUntil(() => runner.prompts.length === 1)
    const posted = runner.prompts[0]
    expect(posted.text).toContain(POST_INSTRUCTIONS)
    expect(posted.text).toContain('Say what changed this week')
    expect(posted.ghost).toBe(true)

    sam.chat('read the readme', [agentId('mac', 'fake')])
    await waitUntil(() => runner.prompts.length === 2)
    expect(runner.prompts[1].text).not.toContain(POST_INSTRUCTIONS)
  })

  it("is the crew's to ask for and never a runner's", async () => {
    const host = await open()
    const runner = await runnerOn(host, 'mac')
    const sam = await connectUi(host, 'sam')
    works(runner, SAID)

    runner.ws.send(JSON.stringify({ type: 'chat.post', text: 'Say what changed this week' }))
    await settle()

    expect(runner.prompts).toEqual([])
    expect(messagesIn(host.store.loadEvents())).toEqual([])
    expect(host.store.loadEvents().some(event => event.kind === 'thread.started')).toBe(false)

    sam.send({ type: 'chat.post', text: 'Say what changed this week' })
    await waitUntil(() => messagesIn(host.session.snapshot().events).some(m => m.text === SAID))
  })
})
