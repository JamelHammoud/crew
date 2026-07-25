import { ICE_SERVERS, type HuddleSignal } from '../../../shared/huddle'

export const SLOTS = ['mic', 'camera', 'screen'] as const

export type Slot = (typeof SLOTS)[number]

export type SlotTracks = Record<Slot, MediaStreamTrack | null>

export type SlotStreams = Record<Slot, MediaStream>

const LIMITS: Record<Slot, { maxBitrate: number; degradation: RTCDegradationPreference } | null> = {
  mic: null,
  camera: { maxBitrate: 900_000, degradation: 'balanced' },
  screen: { maxBitrate: 3_000_000, degradation: 'maintain-resolution' }
}

const RECOVER_AFTER_MS = 6000
const STALL_AFTER_MS = 4000
const MAX_NUDGES = 5

type Timer = ReturnType<typeof setTimeout>

export interface PeerOptions {
  peerId: string
  polite: boolean
  send: (signal: HuddleSignal) => void
  onChange: () => void
}

// One connection to one other person. Its three tracks are negotiated once, at
// the start, and never again: turning a camera or a screen on and off swaps the
// track inside a slot that already exists, so a call settles once and then
// stops renegotiating. Which slot is which is fixed by the order the
// transceivers are created in, and both sides create them the same way.
//
// Only one end of a pair ever offers. Both ends offering is a collision, and
// the rollback that settles a collision does not give the local slots back:
// the browser makes a second set for the offer it accepted, and the three this
// side is listening to end up connected to nothing. The call reaches connected,
// media flows, and nobody hears a thing.
export class PeerLink {
  readonly peerId: string
  readonly remote: SlotStreams
  state: RTCPeerConnectionState = 'new'
  private pc: RTCPeerConnection
  private slots: Record<Slot, RTCRtpTransceiver> | null = null
  private wanted: SlotTracks = { mic: null, camera: null, screen: null }
  private polite: boolean
  private caller: boolean
  private send: (signal: HuddleSignal) => void
  private onChange: () => void
  private makingOffer = false
  private ignoringOffer = false
  private settingAnswer = false
  private waiting: RTCIceCandidateInit[] = []
  private turn: Promise<void> = Promise.resolve()
  private recoverTimer: Timer | null = null
  private stallTimer: Timer | null = null
  private nudges = 0
  private closed = false

  constructor(opts: PeerOptions) {
    this.peerId = opts.peerId
    this.polite = opts.polite
    this.caller = !opts.polite
    this.send = opts.send
    this.onChange = opts.onChange
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' })

    this.remote = { mic: new MediaStream(), camera: new MediaStream(), screen: new MediaStream() }
    if (true) {
      this.bind([
        this.pc.addTransceiver('audio', { direction: 'sendrecv' }),
        this.pc.addTransceiver('video', { direction: 'sendrecv' }),
        this.pc.addTransceiver('video', { direction: 'sendrecv' })
      ])
    }

    this.pc.onnegotiationneeded = () => {
      void this.offer()
    }
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send({ kind: 'candidate', candidate: candidate.toJSON() })
    }
    this.pc.ontrack = event => this.adopt(event)
    this.pc.onconnectionstatechange = () => this.watch()
    if (this.caller) this.expect()
  }

  async publish(tracks: SlotTracks): Promise<void> {
    if (this.closed) return
    this.wanted = { ...tracks }
    await this.apply()
  }

  // The side that answers has no slots until the offer arrives and makes them,
  // so what to send is remembered and put in place the moment there is
  // somewhere to put it.
  private async apply(): Promise<void> {
    const slots = this.slots
    if (this.closed || !slots) return
    for (const slot of SLOTS) {
      const sender = slots[slot].sender
      const next = this.wanted[slot]
      if (sender.track === next) continue
      try {
        await sender.replaceTrack(next)
      } catch {
        continue
      }
      if (next) this.tune(slot)
    }
  }

  // Which slot is which is the order the three lines come in, and that order is
  // the same on both ends because only one end writes it. The side that answers
  // must never make its own: a transceiver added by hand is not one the browser
  // will use for a line it was offered, so making them here leaves this side
  // listening to three that nothing is ever sent on.
  private bind(found: RTCRtpTransceiver[]): void {
    if (this.slots || found.length < SLOTS.length) return
    const slots = {} as Record<Slot, RTCRtpTransceiver>
    SLOTS.forEach((slot, index) => {
      slots[slot] = found[index]
    })
    this.slots = slots
    for (const slot of SLOTS) {
      slots[slot].direction = 'sendrecv'
      this.remote[slot] = new MediaStream([slots[slot].receiver.track])
    }
    this.notify()
  }

  // The first slots are bound while the link is still being built, before
  // anything holds it, so word of them waits until it can be looked up.
  private notify(): void {
    queueMicrotask(() => {
      if (!this.closed) this.onChange()
    })
  }

  // Signals are taken strictly one at a time. Two of them in flight together is
  // how a candidate ends up being offered to a connection that has not been
  // told who it is talking to yet, and a candidate refused that way is gone for
  // good, which leaves the call ringing forever.
  accept(signal: HuddleSignal): Promise<void> {
    if (this.closed) return Promise.resolve()
    this.turn = this.turn.then(() => this.handle(signal)).catch(() => {})
    return this.turn
  }

  close(): void {
    this.closed = true
    this.clear('recoverTimer')
    this.clear('stallTimer')
    this.pc.onnegotiationneeded = null
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.onconnectionstatechange = null
    this.pc.close()
  }

  // A slot is the receiver it was built from, and with one offerer it stays
  // that way. This keeps the slot pointing at whatever actually arrives, so a
  // connection that comes back a different shape is heard rather than silent.
  private adopt(event: RTCTrackEvent): void {
    const slot = SLOTS[this.pc.getTransceivers().indexOf(event.transceiver)]
    if (!slot) return
    const stream = this.remote[slot]
    if (stream.getTracks().includes(event.track)) return
    this.remote[slot] = new MediaStream([event.track])
    this.notify()
  }

  private async handle(signal: HuddleSignal): Promise<void> {
    if (this.closed) return
    if (signal.kind === 'candidate') {
      await this.candidate(signal.candidate as RTCIceCandidateInit)
      return
    }
    try {
      await this.describe(signal.description as RTCSessionDescriptionInit)
    } catch {
      // A description that no longer fits the state it arrived in is the other
      // side having moved on, and the next one will fit.
    }
  }

  // Candidates that arrive ahead of the description they belong to are held,
  // not dropped, and handed over the moment there is something to attach them
  // to. On one machine every candidate arrives in that first rush.
  private async candidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc.remoteDescription) {
      this.waiting.push(candidate)
      return
    }
    await this.add(candidate)
  }

  private async add(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc.addIceCandidate(candidate)
    } catch {
      // A candidate for a description we chose to ignore, or one that arrives
      // after the connection is gone, has nowhere to go.
    }
  }

  private async drain(): Promise<void> {
    const held = this.waiting
    if (held.length === 0) return
    this.waiting = []
    for (const candidate of held) await this.add(candidate)
  }

  private async describe(description: RTCSessionDescriptionInit): Promise<void> {
    const stable = this.pc.signalingState === 'stable'
    const ready = !this.makingOffer && (stable || this.settingAnswer)
    const collision = description.type === 'offer' && !ready
    this.ignoringOffer = !this.polite && collision
    if (this.ignoringOffer) return
    this.settingAnswer = description.type === 'answer'
    await this.pc.setRemoteDescription(description)
    this.settingAnswer = false
    await this.drain()
    if (description.type !== 'offer') return
    this.bind(this.pc.getTransceivers())
    await this.apply()
    await this.pc.setLocalDescription()
    this.send({ kind: 'description', description: this.pc.localDescription?.toJSON() })
  }

  private async offer(): Promise<void> {
    if (this.closed) return
    try {
      this.makingOffer = true
      await this.pc.setLocalDescription()
      this.send({ kind: 'description', description: this.pc.localDescription?.toJSON() })
    } catch {
      // Losing the race to an incoming offer is normal; the other side's
      // description is already on its way.
    } finally {
      this.makingOffer = false
    }
  }

  private tune(slot: Slot): void {
    const limit = LIMITS[slot]
    const sender = this.slots?.[slot].sender
    if (!limit || !sender) return
    const params = sender.getParameters()
    if (params.encodings.length === 0) params.encodings = [{}]
    for (const encoding of params.encodings) encoding.maxBitrate = limit.maxBitrate
    params.degradationPreference = limit.degradation
    void sender.setParameters(params).catch(() => {})
  }

  // A handshake that goes quiet has lost something on the way, and the answer
  // is to say it again rather than to sit and wait. Only the first exchange is
  // ever repeated: once the two ends agree, nothing here speaks again.
  private expect(): void {
    this.clear('stallTimer')
    this.stallTimer = setTimeout(() => {
      this.stallTimer = null
      if (this.closed || this.settled()) return
      if (this.nudges >= MAX_NUDGES) return
      this.nudges += 1
      if (this.pc.signalingState === 'have-local-offer' && this.pc.localDescription) {
        this.send({ kind: 'description', description: this.pc.localDescription.toJSON() })
      } else if (this.pc.signalingState === 'stable' && !this.pc.remoteDescription) {
        void this.offer()
      }
      this.expect()
    }, STALL_AFTER_MS)
  }

  private settled(): boolean {
    return this.pc.signalingState === 'stable' && this.pc.remoteDescription !== null
  }

  private clear(which: 'recoverTimer' | 'stallTimer'): void {
    const timer = this[which]
    if (timer === null) return
    clearTimeout(timer)
    this[which] = null
  }

  // A connection that fails is retried straight away; one that only wobbles is
  // given a few seconds to come back on its own before the ICE restart, and
  // only one side restarts so the two do not fight each other.
  private watch(): void {
    this.state = this.pc.connectionState
    this.onChange()
    this.clear('recoverTimer')
    if (this.state === 'connected') this.clear('stallTimer')
    if (!this.caller) return
    if (this.state === 'failed') {
      this.pc.restartIce()
      return
    }
    if (this.state !== 'disconnected') return
    this.recoverTimer = setTimeout(() => {
      this.recoverTimer = null
      if (this.closed || this.pc.connectionState !== 'disconnected') return
      this.pc.restartIce()
    }, RECOVER_AFTER_MS)
  }
}
