import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Store } from '../src/server/store'
import type { SessionEvent } from '../src/shared/events'
import { emptyRoom, MAX_SIGNAL_CHARS } from '../src/shared/huddle'
import type { ServerMessage } from '../src/shared/protocol'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'

type Room = Extract<ServerMessage, { type: 'huddle.room' }>
type Signal = Extract<ServerMessage, { type: 'huddle.signal' }>
type Logged = Extract<SessionEvent, { kind: `huddle.${string}` }>

const rooms = (ui: TestUi): Room[] => ui.messages.filter((m): m is Room => m.type === 'huddle.room')
const latest = (ui: TestUi): Room['room'] => rooms(ui).at(-1)?.room ?? emptyRoom()
const names = (ui: TestUi): string[] => latest(ui).peers.map(peer => peer.name)
const logged = (host: TestHost): Logged[] =>
  host.store.loadEvents().filter((event): event is Logged => event.kind.startsWith('huddle'))

describe('huddles', () => {
  let host: TestHost
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  async function open(name: string): Promise<TestUi> {
    const ui = await TestUi.connect(host.url, name, host.code)
    uis.push(ui)
    return ui
  }

  it('tells everyone who is in the call, whether they joined it or not', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')
    const watcher = await open('kim')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(watcher).includes('jamel'))

    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: true, camera: false })
    await waitUntil(() => names(jamel).length === 2)

    expect(names(jamel)).toEqual(['jamel', 'sam'])
    expect(latest(jamel).peers.map(peer => peer.muted)).toEqual([false, true])
    expect(latest(watcher).startedAt).not.toBeNull()
  })

  it('starts a call empty again once the last person leaves', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 2)
    const first = latest(jamel).startedAt

    jamel.send({ type: 'huddle.leave' })
    await waitUntil(() => names(sam).length === 1)
    expect(latest(sam).startedAt).toBe(first)

    sam.send({ type: 'huddle.leave' })
    await waitUntil(() => rooms(sam).length > 0 && latest(sam).peers.length === 0)
    expect(latest(sam).startedAt).toBeNull()
  })

  it('carries offers and candidates to the one person they were addressed to', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')
    const kim = await open('kim')

    for (const [ui, peerId] of [
      [jamel, 'peer-jamel'],
      [sam, 'peer-sam'],
      [kim, 'peer-kim']
    ] as const) {
      ui.send({ type: 'huddle.join', peerId, muted: false, camera: false })
    }
    await waitUntil(() => names(kim).length === 3)

    jamel.send({
      type: 'huddle.signal',
      to: 'peer-sam',
      signal: { kind: 'description', description: { type: 'offer', sdp: 'v=0' } }
    })
    const delivered = (await sam.waitFor(m => m.type === 'huddle.signal')) as Signal

    expect(delivered.from).toBe('peer-jamel')
    expect(delivered.signal).toEqual({ kind: 'description', description: { type: 'offer', sdp: 'v=0' } })
    expect(kim.messages.some(m => m.type === 'huddle.signal')).toBe(false)
  })

  it('will not relay for someone who is not in the call, or a signal too big to be one', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')
    const outsider = await open('kim')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(sam).length === 2)

    outsider.send({
      type: 'huddle.signal',
      to: 'peer-sam',
      signal: { kind: 'description', description: { type: 'offer', sdp: 'from outside' } }
    })
    jamel.send({
      type: 'huddle.signal',
      to: 'peer-sam',
      signal: { kind: 'description', description: { type: 'offer', sdp: 'x'.repeat(MAX_SIGNAL_CHARS) } }
    })
    jamel.send({
      type: 'huddle.signal',
      to: 'peer-sam',
      signal: { kind: 'candidate', candidate: { candidate: 'the real one' } }
    })

    const delivered = (await sam.waitFor(m => m.type === 'huddle.signal')) as Signal
    expect(delivered.signal).toEqual({ kind: 'candidate', candidate: { candidate: 'the real one' } })
    expect(sam.messages.filter(m => m.type === 'huddle.signal')).toHaveLength(1)
  })

  it('passes on a camera going on and a screen being shared', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(sam).length === 1)

    jamel.send({ type: 'huddle.update', camera: true, sharing: true })
    await waitUntil(() => latest(sam).peers[0]?.sharing === true)

    expect(latest(sam).peers[0].camera).toBe(true)
    expect(latest(sam).peers[0].muted).toBe(false)
  })

  it('lets a new screen take over from the one already up', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')
    const kim = await open('kim')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(kim).length === 2)

    jamel.send({ type: 'huddle.update', sharing: true })
    await waitUntil(() => latest(kim).peers.some(peer => peer.peerId === 'peer-jamel' && peer.sharing))

    sam.send({ type: 'huddle.update', sharing: true })
    await waitUntil(() => latest(kim).peers.some(peer => peer.peerId === 'peer-sam' && peer.sharing))

    expect(latest(kim).peers.filter(peer => peer.sharing).map(peer => peer.peerId)).toEqual(['peer-sam'])
  })

  it('keeps the place a returning window had in the room', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(sam).length === 1)
    jamel.send({ type: 'huddle.update', sharing: true })
    await waitUntil(() => latest(sam).peers[0]?.sharing === true)
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(sam).length === 2)

    const back = await open('jamel')
    back.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => latest(sam).peers.length === 2)

    expect(names(sam)).toEqual(['jamel', 'sam'])
    expect(latest(sam).peers[0].sharing).toBe(true)
  })

  it('lets a window that dropped and came back take its own place again', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(sam).length === 2)

    const back = await open('jamel')
    back.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: true, camera: false })
    await waitUntil(() => latest(sam).peers.some(peer => peer.peerId === 'peer-jamel' && peer.muted))

    expect(latest(sam).peers).toHaveLength(2)

    back.send({
      type: 'huddle.signal',
      to: 'peer-sam',
      signal: { kind: 'candidate', candidate: { candidate: 'after reconnect' } }
    })
    const delivered = (await sam.waitFor(m => m.type === 'huddle.signal')) as Signal
    expect(delivered.from).toBe('peer-jamel')
  })

  it('takes someone out of the call when their window goes away', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(sam).length === 2)

    jamel.close()
    await waitUntil(() => names(sam).length === 1)
    expect(names(sam)).toEqual(['sam'])
  })

  it('hands the call to whoever joins next through the snapshot', async () => {
    const jamel = await open('jamel')
    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: true, camera: false })
    await waitUntil(() => names(jamel).length === 1)

    const late = await open('sam')
    const welcome = late.messages.find(m => m.type === 'welcome')
    expect(welcome?.type === 'welcome' && welcome.snapshot.huddle?.peers).toHaveLength(1)
    expect(welcome?.type === 'welcome' && welcome.snapshot.huddle?.peers[0].name).toBe('jamel')
  })

  it('keeps the call itself out of the event log so none of it is ever committed', async () => {
    const jamel = await open('jamel')
    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 1)
    jamel.send({ type: 'huddle.update', sharing: true })
    await waitUntil(() => latest(jamel).peers[0]?.sharing === true)
    jamel.send({
      type: 'huddle.signal',
      to: 'peer-jamel',
      signal: { kind: 'candidate', candidate: { candidate: 'a route to somewhere' } }
    })

    expect(logged(host).map(event => event.kind)).toEqual(['huddle.started'])
    const written = JSON.stringify(host.store.loadEvents())
    expect(written).not.toContain('peer-jamel')
    expect(written).not.toContain('a route to somewhere')
    expect(written).not.toContain('sharing')
  })

  it('records who started a call, who came to it, and how long it ran', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 1)
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 2)

    jamel.send({ type: 'huddle.leave' })
    sam.send({ type: 'huddle.leave' })
    await waitUntil(() => logged(host).some(event => event.kind === 'huddle.ended'))

    const [started, joined, ended] = logged(host)
    expect([started.kind, joined.kind, ended.kind]).toEqual(['huddle.started', 'huddle.joined', 'huddle.ended'])
    expect(started.kind === 'huddle.started' && started.byName).toBe('jamel')
    expect(joined.kind === 'huddle.joined' && joined.name).toBe('sam')
    expect(ended.kind === 'huddle.ended' && ended.ms >= 0).toBe(true)
    expect(new Set(logged(host).map(event => event.huddleId)).size).toBe(1)
  })

  it('names someone once however many times they come back to the same call', async () => {
    const jamel = await open('jamel')
    const sam = await open('sam')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 1)
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 2)
    sam.send({ type: 'huddle.leave' })
    await waitUntil(() => names(jamel).length === 1)
    sam.send({ type: 'huddle.join', peerId: 'peer-sam', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 2)

    expect(logged(host).filter(event => event.kind === 'huddle.joined')).toHaveLength(1)
  })

  it('starts a record of its own for the next call', async () => {
    const jamel = await open('jamel')

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 1)
    jamel.send({ type: 'huddle.leave' })
    await waitUntil(() => logged(host).some(event => event.kind === 'huddle.ended'))

    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel-again', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 1)

    const starts = logged(host).filter(event => event.kind === 'huddle.started')
    expect(starts).toHaveLength(2)
    expect(starts[0].huddleId).not.toBe(starts[1].huddleId)
    expect(latest(jamel).id).toBe(starts[1].huddleId)
  })

  // A crash leaves a start in the log with no end, and a block with no end
  // reads as live forever. Coming back up closes it where the session last
  // said anything.
  it('closes a call that was still going when the host went down', async () => {
    const repoPath = tmpDir('huddle-restart')
    const store = new Store(repoPath)
    store.appendEvent({
      id: 'started',
      ts: 1000,
      kind: 'huddle.started',
      huddleId: 'call-1',
      byId: 'm-jamel',
      byName: 'jamel'
    })
    store.appendEvent({
      id: 'after',
      ts: 5000,
      kind: 'message',
      authorId: 'm-jamel',
      authorName: 'jamel',
      text: 'back in a sec',
      mentions: []
    })

    const again = await startHost(repoPath)
    const written = again.store.loadEvents().filter(event => event.kind.startsWith('huddle'))
    await again.close()

    expect(written.map(event => event.kind)).toEqual(['huddle.started', 'huddle.ended'])
    const ended = written[1]
    expect(ended.kind === 'huddle.ended' && ended.ms).toBe(4000)
  })
})
