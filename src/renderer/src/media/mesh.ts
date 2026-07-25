import { politeToward, type HuddleSignal } from '../../../shared/huddle'
import { PeerLink, SLOTS, type SlotStreams, type SlotTracks } from './peer'

export interface MeshOptions {
  send: (to: string, signal: HuddleSignal) => void
  onChange: () => void
}

const EMPTY: SlotTracks = { mic: null, camera: null, screen: null }

const EARLY_LIMIT = 64

// Everyone connects to everyone. A crew is a handful of people, so a mesh beats
// running a media server: nothing to host, nothing in the middle.
export class HuddleMesh {
  private links = new Map<string, PeerLink>()
  private early = new Map<string, HuddleSignal[]>()
  private tracks: SlotTracks = { ...EMPTY }
  private selfPeerId = ''

  constructor(private opts: MeshOptions) {}

  sync(selfPeerId: string, peerIds: string[]): void {
    this.selfPeerId = selfPeerId
    const wanted = new Set(peerIds.filter(id => id !== selfPeerId))
    let changed = false
    for (const [peerId, link] of [...this.links]) {
      if (wanted.has(peerId)) continue
      link.close()
      this.links.delete(peerId)
      this.early.delete(peerId)
      changed = true
    }
    for (const peerId of wanted) {
      if (this.links.has(peerId)) continue
      const link = new PeerLink({
        peerId,
        polite: politeToward(selfPeerId, peerId),
        send: signal => this.opts.send(peerId, signal),
        onChange: this.opts.onChange
      })
      this.links.set(peerId, link)
      void link.publish(this.tracks)
      for (const signal of this.early.get(peerId) ?? []) void link.accept(signal)
      this.early.delete(peerId)
      changed = true
    }
    if (changed) this.opts.onChange()
  }

  publish(tracks: SlotTracks): void {
    const same = SLOTS.every(slot => this.tracks[slot] === tracks[slot])
    if (same) return
    this.tracks = { ...tracks }
    for (const link of this.links.values()) void link.publish(this.tracks)
  }

  // Someone can start dialing a fraction before the roster naming them lands.
  // What they said is kept until the link exists rather than thrown away.
  accept(from: string, signal: HuddleSignal): void {
    const link = this.links.get(from)
    if (link) {
      void link.accept(signal)
      return
    }
    const held = this.early.get(from) ?? []
    if (held.length >= EARLY_LIMIT) held.shift()
    held.push(signal)
    this.early.set(from, held)
  }

  streamsOf(peerId: string): SlotStreams | null {
    return this.links.get(peerId)?.remote ?? null
  }

  stateOf(peerId: string): RTCPeerConnectionState | null {
    return this.links.get(peerId)?.state ?? null
  }

  close(): void {
    for (const link of this.links.values()) link.close()
    this.links.clear()
    this.tracks = { ...EMPTY }
    this.selfPeerId = ''
  }

  get self(): string {
    return this.selfPeerId
  }
}
