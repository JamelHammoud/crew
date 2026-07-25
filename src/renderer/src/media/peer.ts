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
export class PeerLink {
  readonly peerId: string
  readonly remote: SlotStreams
  state: RTCPeerConnectionState = 'new'
  private pc: RTCPeerConnection
  private senders: Record<Slot, RTCRtpSender>
  private polite: boolean
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
    this.send = opts.send
    this.onChange = opts.onChange
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, bundlePolicy: 'max-bundle' })

    const transceivers: Record<Slot, RTCRtpTransceiver> = {
      mic: this.pc.addTransceiver('audio', { direction: 'sendrecv' }),
      camera: this.pc.addTransceiver('video', { direction: 'sendrecv' }),
      screen: this.pc.addTransceiver('video', { direction: 'sendrecv' })
    }
    this.senders = { mic: transceivers.mic.sender, camera: transceivers.camera.sender, screen: transceivers.screen.sender }
    this.remote = {
      mic: new MediaStream([transceivers.mic.receiver.track]),
      camera: new MediaStream([transceivers.camera.receiver.track]),
      screen: new MediaStream([transceivers.screen.receiver.track])
    }

    this.pc.onnegotiationneeded = () => void this.offer()
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send({ kind: 'candidate', candidate: candidate.toJSON() })
    }
    this.pc.onconnectionstatechange = () => this.watch()
    this.expect()
  }

  async publish(tracks: SlotTracks): Promise<void> {
    if (this.closed) return
    for (const slot of SLOTS) {
      const sender = this.senders[slot]
      const next = tracks[slot]
      if (sender.track === next) continue
      try {
        await sender.replaceTrack(next)
      } catch {
        continue
      }
      if (next) this.tune(slot)
    }
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
    this.pc.onconnectionstatechange = null
    this.pc.close()
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
    const sender = this.senders[slot]
    if (!limit) return
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
    if (this.polite) return
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
