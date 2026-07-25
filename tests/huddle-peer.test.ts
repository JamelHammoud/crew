import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HuddleMesh } from '../src/renderer/src/media/mesh'
import { PeerLink } from '../src/renderer/src/media/peer'
import type { HuddleSignal } from '../src/shared/huddle'
import { fakeTrack, FakePeerConnection, installFakeRtc, settle } from './helpers/fake-rtc'

// Two links wired straight into each other, the way two machines are once the
// host is relaying between them.
function pair(opts: { hold?: boolean } = {}): {
  a: PeerLink
  b: PeerLink
  flush: () => Promise<void>
  close: () => void
} {
  const held: Array<() => void> = []
  const deliver = (run: () => void) => {
    if (opts.hold) held.push(run)
    else run()
  }
  let a: PeerLink
  let b: PeerLink
  a = new PeerLink({
    peerId: 'peer-b',
    polite: true,
    send: signal => deliver(() => void b.accept(signal)),
    onChange: () => {}
  })
  b = new PeerLink({
    peerId: 'peer-a',
    polite: false,
    send: signal => deliver(() => void a.accept(signal)),
    onChange: () => {}
  })
  return {
    a,
    b,
    // Each delivery can produce the next one a microtask later, so the queue is
    // drained until the two ends stop answering each other.
    flush: async () => {
      for (let round = 0; round < 8; round++) {
        while (held.length > 0) held.shift()?.()
        await settle()
      }
    },
    close: () => {
      a.close()
      b.close()
    }
  }
}

const connections = (): FakePeerConnection[] => FakePeerConnection.made

describe('one connection to one person', () => {
  beforeEach(() => installFakeRtc())
  afterEach(() => {
    FakePeerConnection.made = []
  })

  it('settles into a stable connection from both ends', async () => {
    const link = pair()
    await settle()
    await link.flush()

    expect(connections()).toHaveLength(2)
    expect(connections().map(pc => pc.signalingState)).toEqual(['stable', 'stable'])
    link.close()
  })

  it('gives the same three slots the same meaning on both ends', async () => {
    const link = pair()
    await settle()

    for (const pc of connections()) {
      expect(pc.transceivers.map(t => t.sender.kind)).toEqual(['audio', 'video', 'video'])
    }
    link.close()
  })

  it('lets the impolite side keep its offer when both speak at once', async () => {
    const link = pair({ hold: true })
    await settle()
    await link.flush()

    const [polite, impolite] = connections()
    expect(polite.rollbacks).toBe(1)
    expect(impolite.rollbacks).toBe(0)
    expect(polite.signalingState).toBe('stable')
    expect(impolite.signalingState).toBe('stable')
    link.close()
  })

  it('turns a camera on without going back to the negotiating table', async () => {
    const link = pair()
    await settle()
    await link.flush()
    const before = connections().map(pc => pc.signalingState)

    await link.a.publish({ mic: fakeTrack('audio', 'mic'), camera: fakeTrack('video', 'cam'), screen: null })
    await settle()

    const [first] = connections()
    expect(first.transceivers[0].sender.track?.id).toBe('mic')
    expect(first.transceivers[1].sender.track?.id).toBe('cam')
    expect(first.transceivers[2].sender.track).toBeNull()
    expect(connections().map(pc => pc.signalingState)).toEqual(before)
    link.close()
  })

  it('gives a screen more room than a camera', async () => {
    const link = pair()
    await settle()

    await link.a.publish({ mic: null, camera: fakeTrack('video', 'cam'), screen: fakeTrack('video', 'scr') })
    await settle()

    const [first] = connections()
    const camera = first.transceivers[1].sender.parameters
    const screen = first.transceivers[2].sender.parameters
    expect(screen.encodings[0].maxBitrate).toBeGreaterThan(camera.encodings[0].maxBitrate ?? 0)
    expect(screen.degradationPreference).toBe('maintain-resolution')
    link.close()
  })

  it('has only the impolite side reach for a restart, and only once it has failed', async () => {
    const link = pair()
    await settle()
    const [polite, impolite] = connections()

    polite.setConnectionState('failed')
    impolite.setConnectionState('failed')

    expect(polite.restarts).toBe(0)
    expect(impolite.restarts).toBe(1)
    link.close()
  })

  it('drops everything it was holding when it closes', async () => {
    const link = pair()
    await settle()
    link.close()

    expect(connections().every(pc => pc.closed)).toBe(true)
  })
})

describe('a mesh of everyone', () => {
  beforeEach(() => installFakeRtc())
  afterEach(() => {
    FakePeerConnection.made = []
  })

  it('opens one connection per other person and closes them as people leave', async () => {
    const sent: Array<{ to: string; signal: HuddleSignal }> = []
    const mesh = new HuddleMesh({ send: (to, signal) => sent.push({ to, signal }), onChange: () => {} })

    mesh.sync('me', ['me', 'a', 'b'])
    expect(connections()).toHaveLength(2)

    mesh.sync('me', ['me', 'a'])
    expect(connections().filter(pc => !pc.closed)).toHaveLength(1)
    expect(mesh.streamsOf('b')).toBeNull()
    expect(mesh.streamsOf('a')).not.toBeNull()

    mesh.close()
    expect(connections().every(pc => pc.closed)).toBe(true)
  })

  it('never dials itself', () => {
    const mesh = new HuddleMesh({ send: () => {}, onChange: () => {} })
    mesh.sync('me', ['me'])
    expect(connections()).toHaveLength(0)
    mesh.close()
  })

  it('hands a new arrival what everyone else is already sending', async () => {
    const mesh = new HuddleMesh({ send: () => {}, onChange: () => {} })
    mesh.sync('me', ['me', 'a'])
    mesh.publish({ mic: fakeTrack('audio', 'mic'), camera: null, screen: null })
    await settle()

    mesh.sync('me', ['me', 'a', 'b'])
    await settle()

    const latest = connections().at(-1)!
    expect(latest.transceivers[0].sender.track?.id).toBe('mic')
    mesh.close()
  })
})
