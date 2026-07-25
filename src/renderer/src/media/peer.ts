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
  private recoverTimer: number | null = null
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

  async accept(signal: HuddleSignal): Promise<void> {
    if (this.closed) return
    try {
      if (signal.kind === 'candidate') {
        await this.pc.addIceCandidate(signal.candidate as RTCIceCandidateInit)
        return
      }
      await this.describe(signal.description as RTCSessionDescriptionInit)
    } catch {
      // A candidate arriving for an offer we chose to ignore, or after the
      // connection went away, is expected and not worth surfacing.
    }
  }

  close(): void {
    this.closed = true
    if (this.recoverTimer !== null) window.clearTimeout(this.recoverTimer)
    this.pc.onnegotiationneeded = null
    this.pc.onicecandidate = null
    this.pc.onconnectionstatechange = null
    this.pc.close()
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

  // A connection that fails is retried straight away; one that only wobbles is
  // given a few seconds to come back on its own before the ICE restart, and
  // only one side restarts so the two do not fight each other.
  private watch(): void {
    this.state = this.pc.connectionState
    this.onChange()
    if (this.recoverTimer !== null) {
      window.clearTimeout(this.recoverTimer)
      this.recoverTimer = null
    }
    if (this.polite) return
    if (this.state === 'failed') {
      this.pc.restartIce()
      return
    }
    if (this.state !== 'disconnected') return
    this.recoverTimer = window.setTimeout(() => {
      this.recoverTimer = null
      if (this.closed || this.pc.connectionState !== 'disconnected') return
      this.pc.restartIce()
    }, RECOVER_AFTER_MS)
  }
}
