import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_SIGNAL_CHARS } from '../src/shared/huddle'
import type { ServerMessage } from '../src/shared/protocol'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Room = Extract<ServerMessage, { type: 'huddle.room' }>
type Signal = Extract<ServerMessage, { type: 'huddle.signal' }>

const rooms = (ui: TestUi): Room[] => ui.messages.filter((m): m is Room => m.type === 'huddle.room')
const latest = (ui: TestUi): Room['room'] => rooms(ui).at(-1)?.room ?? { peers: [], startedAt: null }
const names = (ui: TestUi): string[] => latest(ui).peers.map(peer => peer.name)

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

  it('keeps the call out of the event log so it is never committed', async () => {
    const jamel = await open('jamel')
    jamel.send({ type: 'huddle.join', peerId: 'peer-jamel', muted: false, camera: false })
    await waitUntil(() => names(jamel).length === 1)
    jamel.send({ type: 'huddle.update', sharing: true })
    await waitUntil(() => latest(jamel).peers[0]?.sharing === true)

    expect(host.store.loadEvents().some(event => event.kind.startsWith('huddle'))).toBe(false)
  })
})
