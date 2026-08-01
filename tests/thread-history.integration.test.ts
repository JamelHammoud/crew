import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mergeEvents, type SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, tmpDir, TestUi, type TestHost } from './helpers/session'

type ThreadStarted = Extract<SessionEvent, { kind: 'thread.started' }>

const settle = () => new Promise(r => setTimeout(r, 300))

const START = 1_700_000_000_000
const OLD = 'thread-old'

// The thread as the log holds it: opened, asked, worked in, a helper sent out
// and brought home, finished. Everything after it is what pushes it off the end
// of the window a snapshot carries.
const worked = (): SessionEvent[] => [
  {
    id: 'old-started',
    ts: START,
    kind: 'thread.started',
    threadId: OLD,
    agentId: 'agent-1',
    agentLabel: 'Bubbles',
    title: 'the best way to add usage',
    byName: 'alice'
  },
  {
    id: 'old-asked',
    ts: START + 1,
    kind: 'message',
    authorId: 'alice',
    authorName: 'alice',
    text: '@Bubbles what is the best way to add usage',
    mentions: ['agent-1'],
    threadId: OLD
  },
  {
    id: 'old-start',
    ts: START + 2,
    kind: 'agent.start',
    promptId: 'prompt-old',
    agentId: 'agent-1',
    agentLabel: 'Bubbles',
    promptText: 'what is the best way to add usage',
    byName: 'alice',
    threadId: OLD
  },
  {
    id: 'old-step',
    ts: START + 3,
    kind: 'agent.step',
    promptId: 'prompt-old',
    agentId: 'agent-1',
    agentLabel: 'Bubbles',
    threadId: OLD,
    step: { id: 'step-1', ts: START + 3, kind: 'tool', status: 'done', name: 'Read', detail: 'pricing.ts' }
  },
  {
    id: 'old-sent',
    ts: START + 4,
    kind: 'subagent.started',
    threadId: 'thread-helper',
    parentThreadId: OLD,
    parentPromptId: 'prompt-old',
    name: 'Scout',
    subject: 'reading the rates',
    agentId: 'agent-1',
    agentLabel: 'Bubbles',
    byName: 'alice'
  },
  {
    id: 'old-home',
    ts: START + 5,
    kind: 'subagent.ended',
    threadId: 'thread-helper',
    parentThreadId: OLD,
    ok: true,
    ms: 1200
  },
  {
    id: 'old-end',
    ts: START + 6,
    kind: 'agent.end',
    promptId: 'prompt-old',
    agentId: 'agent-1',
    agentLabel: 'Bubbles',
    ok: true,
    text: 'Here is the plan.',
    threadId: OLD
  }
]

const since = (count: number): SessionEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `since-${String(i).padStart(5, '0')}`,
    ts: START + 1000 + i * 1000,
    kind: 'message' as const,
    authorId: 'alice',
    authorName: 'alice',
    text: `message ${i}`,
    mentions: []
  }))

const seed = (repoPath: string, events: SessionEvent[]): void => {
  const dir = path.join(repoPath, '.crew', 'chat')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '0001.jsonl'), events.map(event => JSON.stringify(event) + '\n').join(''))
}

const read = (msg: ServerMessage): { threadId: string; events: SessionEvent[] } => {
  if (msg.type !== 'thread.history') throw new Error('not a thread read back')
  return { threadId: msg.threadId, events: msg.events }
}

describe('reading one thread back out of the log', () => {
  let host: TestHost
  let uis: TestUi[] = []

  beforeEach(async () => {
    const repoPath = tmpDir('thread-history')
    seed(repoPath, [...worked(), ...since(600)])
    host = await startHost(repoPath)
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  it('hands over a thread the window has scrolled past, whole', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    // The row is still in the rail and the thread is still in the chat, and
    // there is not one event left to draw it from. That is the whole bug.
    const snapshot = host.session.snapshot()
    expect(snapshot.threadEvents?.some(event => event.threadId === OLD)).toBe(true)
    expect(snapshot.events.some(event => 'threadId' in event && event.threadId === OLD)).toBe(false)

    alice.send({ type: 'thread.history', threadId: OLD })
    const page = read(await alice.waitFor(msg => msg.type === 'thread.history'))

    expect(page.threadId).toBe(OLD)
    expect(page.events.map(event => event.id)).toEqual(worked().map(event => event.id))
    expect(page.events.filter(event => event.kind === 'agent.step')).toHaveLength(1)
  })

  it('goes to the one who asked for it', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)

    alice.send({ type: 'thread.history', threadId: OLD })
    await alice.waitFor(msg => msg.type === 'thread.history')
    await settle()
    expect(bob.messages.some(msg => msg.type === 'thread.history')).toBe(false)
  })

  it('has nothing to say about a thread that never happened', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    alice.send({ type: 'thread.history', threadId: 'thread-nobody' })
    const page = read(await alice.waitFor(msg => msg.type === 'thread.history'))
    expect(page.events).toEqual([])
  })
})

describe('reading a ghost thread back', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  it('answers the window that opened it and nobody else', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)
    const runner = testRunner({
      name: 'sam',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({}, 'fake', 'Fake')],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await sam.waitForEvent(event => event.kind === 'agent.online')

    sam.chat('@Fake read the readme', [agentId('sam', 'fake')], undefined, ['ghost'])
    const thread = (await sam.waitForEvent(event => event.kind === 'thread.started')) as ThreadStarted
    await sam.waitForEvent(event => event.kind === 'agent.end')

    sam.send({ type: 'thread.history', threadId: thread.threadId })
    const page = read(await sam.waitFor(msg => msg.type === 'thread.history'))
    expect(page.events.some(event => event.kind === 'message')).toBe(true)

    // A hidden thread whose history is not hidden is a hidden thread that leaks,
    // so the answer to anybody else is no answer at all.
    pat.send({ type: 'thread.history', threadId: thread.threadId })
    await settle()
    expect(pat.messages.some(msg => msg.type === 'thread.history')).toBe(false)
  })
})

describe('putting a thread back where it happened', () => {
  const at = (id: string, ts: number): SessionEvent => ({
    id,
    ts,
    kind: 'message',
    authorId: 'alice',
    authorName: 'alice',
    text: id,
    mentions: []
  })

  it('merges by when rather than pushing the older run on the front', () => {
    const held = [at('b', 2), at('d', 4)]
    const older = [at('a', 1), at('c', 3), at('e', 5)]
    expect(mergeEvents(older, held).map(event => event.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('keeps the copy already held, and hands the same run back untouched', () => {
    const held = [at('a', 1), at('b', 2)]
    const same = mergeEvents([at('a', 1)], held)
    expect(same).toBe(held)
  })
})
