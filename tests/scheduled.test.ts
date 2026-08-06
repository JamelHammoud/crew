import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { SessionEvent } from '../src/shared/events'
import type { ClientMessage, RegisteredLlm, ServerMessage } from '../src/shared/protocol'
import { SCHEDULE_FULL, SCHEDULE_LIMIT, type Schedule } from '../src/shared/schedules'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'

type Notice = Extract<ServerMessage, { type: 'notice' }>

const STANDUP: ClientMessage = {
  type: 'schedule.add',
  name: 'Standup',
  mark: 'clock',
  when: { kind: 'daily', at: 9 * 60 },
  action: { kind: 'say', text: 'Morning' },
  zone: 'Europe/Lisbon'
}

const named = (name: string): ClientMessage => ({ ...STANDUP, name })

const schedulesIn = (host: TestHost): Schedule[] => host.session.snapshot().schedules ?? []

interface FakeRunner {
  ws: WebSocket
  messages: ServerMessage[]
}

async function runnerOn(host: TestHost, name: string, llms: RegisteredLlm[] = []): Promise<FakeRunner> {
  const ws = new WebSocket(host.url)
  const runner: FakeRunner = { ws, messages: [] }
  ws.on('message', raw => runner.messages.push(JSON.parse(raw.toString()) as ServerMessage))
  await new Promise<void>((resolve, reject) => {
    ws.on('error', reject)
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', role: 'runner', name, code: host.code, llms }))
      resolve()
    })
  })
  return runner
}

describe('what the crew has put on a clock', () => {
  let host: TestHost
  let uis: TestUi[] = []
  let runners: FakeRunner[] = []

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

  it('takes one from anybody here and hands it to everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send(STANDUP)
    const landed = await pat.waitForEvent(e => e.kind === 'schedule.added')
    if (landed.kind !== 'schedule.added') throw new Error('expected schedule.added')
    expect(landed.name).toBe('Standup')
    expect(landed.byName).toBe('sam')
    await waitUntil(() => schedulesIn(host).length === 1)
  })

  it('rides in the snapshot and never in the chat', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    await sam.waitForEvent(e => e.kind === 'schedule.added')

    const late = await TestUi.connect(host.url, 'late', host.code)
    uis.push(late)
    const welcome = late.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    expect(welcome.snapshot.schedules).toHaveLength(1)
    expect(welcome.snapshot.events.some(event => event.kind.startsWith('schedule.'))).toBe(false)

    const revived = new CrewSession(host.store).snapshot()
    expect(revived.schedules).toEqual([expect.objectContaining({ name: 'Standup', createdBy: 'sam' })])
    expect(revived.events.some(event => event.kind.startsWith('schedule.'))).toBe(false)
  })

  it('refuses one that needs somebody standing at a screen', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send({ ...STANDUP, action: { kind: 'terminal', command: 'yarn build' } })
    sam.send({ ...STANDUP, name: 'Second' })
    await sam.waitForEvent(e => e.kind === 'schedule.added')
    expect(schedulesIn(host).map(one => one.name)).toEqual(['Second'])
  })

  it('says so rather than dropping the oldest when it is full', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    for (let i = 0; i < SCHEDULE_LIMIT; i++) sam.send(named(`One ${i}`))
    await waitUntil(() => schedulesIn(host).length === SCHEDULE_LIMIT)

    sam.send(named('One more'))
    const said = (await sam.waitFor(m => m.type === 'notice')) as Notice
    expect(said.text).toBe(SCHEDULE_FULL)
    expect(schedulesIn(host)).toHaveLength(SCHEDULE_LIMIT)
  })

  it('is paused without being lost, and comes back on', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    const added = await sam.waitForEvent(e => e.kind === 'schedule.added')
    if (added.kind !== 'schedule.added') throw new Error('expected schedule.added')

    sam.send({ type: 'schedule.pause', scheduleId: added.scheduleId, paused: true })
    await waitUntil(() => schedulesIn(host)[0]?.paused === true)
    expect(schedulesIn(host)).toHaveLength(1)

    sam.send({ type: 'schedule.pause', scheduleId: added.scheduleId, paused: false })
    await waitUntil(() => schedulesIn(host)[0]?.paused === false)
  })

  // The record of what it did is what a session coming back up reads to know
  // where it got to, so it has to survive a restart the schedule itself does.
  it('remembers when it last ran across a restart', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    const added = await sam.waitForEvent(e => e.kind === 'schedule.added')
    if (added.kind !== 'schedule.added') throw new Error('expected schedule.added')

    host.session.testStrike()
    await waitUntil(() => (schedulesIn(host)[0]?.lastRunAt ?? 0) > 0)
    const ran = schedulesIn(host)[0].lastRunAt
    expect(new CrewSession(host.store).snapshot().schedules?.[0].lastRunAt).toBe(ran)
    expect(added.scheduleId).toBeTruthy()
  })

  // A laptop shut for a week comes back to one run of each, never seven.
  it('fires once for a run it slept through rather than catching up', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    await sam.waitForEvent(e => e.kind === 'schedule.added')

    host.session.testStrike()
    await waitUntil(() => sam.events.filter(e => e.kind === 'schedule.ran').length === 1)
    host.session.testStrike()
    host.session.testStrike()
    await new Promise(r => setTimeout(r, 250))
    expect(sam.events.filter(e => e.kind === 'schedule.ran')).toHaveLength(1)
  })

  it('does what it says when it comes round', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    await sam.waitForEvent(e => e.kind === 'schedule.added')

    host.session.testStrike()
    const said = await sam.waitForEvent(e => e.kind === 'message' && e.text === 'Morning')
    expect(said.kind).toBe('message')
  })

  it('adds a task to the crew\'s own list when that is what it is for', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send({ ...STANDUP, name: 'Water', action: { kind: 'todo', text: 'Water the plants' } })
    await sam.waitForEvent(e => e.kind === 'schedule.added')

    host.session.testStrike()
    await waitUntil(() => host.session.snapshot().todos.some(one => one.text === 'Water the plants'))
  })

  // A run somebody asked for is not the run it was written for, so it must not
  // move when the next one is due.
  it('runs by hand without moving the clock', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    const added = await sam.waitForEvent(e => e.kind === 'schedule.added')
    if (added.kind !== 'schedule.added') throw new Error('expected schedule.added')

    sam.send({ type: 'schedule.run', scheduleId: added.scheduleId })
    await sam.waitForEvent(e => e.kind === 'message' && e.text === 'Morning')
    await new Promise(r => setTimeout(r, 100))
    expect(schedulesIn(host)[0].lastRunAt).toBeUndefined()
    expect(sam.events.some(e => e.kind === 'schedule.ran')).toBe(false)
  })

  it('leaves them to the crew rather than to a runner', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    const added = await sam.waitForEvent(e => e.kind === 'schedule.added')
    if (added.kind !== 'schedule.added') throw new Error('expected schedule.added')

    const runner = await runnerOn(host, 'mac')
    runners.push(runner)
    runner.ws.send(JSON.stringify(named('theirs')))
    runner.ws.send(JSON.stringify({ type: 'schedule.remove', scheduleId: added.scheduleId }))
    runner.ws.send(JSON.stringify({ type: 'schedule.pause', scheduleId: added.scheduleId, paused: true }))
    await new Promise(r => setTimeout(r, 250))

    expect(schedulesIn(host)).toHaveLength(1)
    expect(schedulesIn(host)[0]).toMatchObject({ id: added.scheduleId, name: 'Standup', paused: undefined })
  })

  it('goes for good when it is taken out', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(STANDUP)
    const added = await sam.waitForEvent(e => e.kind === 'schedule.added')
    if (added.kind !== 'schedule.added') throw new Error('expected schedule.added')

    sam.send({ type: 'schedule.remove', scheduleId: added.scheduleId })
    await waitUntil(() => schedulesIn(host).length === 0)
    expect(new CrewSession(host.store).snapshot().schedules).toEqual([])
  })
})
