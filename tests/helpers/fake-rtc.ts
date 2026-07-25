// A stand-in for the browser's connection that keeps the parts the negotiation
// depends on honest: which descriptions a signaling state will accept, which
// slots a line in a description is allowed to land on, and the rollback that
// happens when an offer arrives on top of one already sent.

export interface FakeDescription {
  type: 'offer' | 'answer'
  sdp: string
  toJSON: () => { type: string; sdp: string }
}

const LINES = ['audio', 'video', 'video']

function description(type: 'offer' | 'answer', sdp: string): FakeDescription {
  return { type, sdp, toJSON: () => ({ type, sdp }) }
}

function linesIn(sdp: string): string[] {
  const [, encoded] = sdp.split('|')
  return encoded ? encoded.split(',') : LINES
}

class FakeSender {
  track: MediaStreamTrack | null = null
  parameters: { encodings: Array<{ maxBitrate?: number }>; degradationPreference?: string } = {
    encodings: [{}]
  }
  constructor(readonly kind: string) {}
  async replaceTrack(track: MediaStreamTrack | null): Promise<void> {
    this.track = track
  }
  getParameters(): typeof this.parameters {
    return { encodings: this.parameters.encodings.map(e => ({ ...e })) }
  }
  async setParameters(params: typeof this.parameters): Promise<void> {
    this.parameters = params
  }
}

export class FakeTransceiver {
  mid: string | null = null
  direction = 'sendrecv'
  currentDirection: string | null = null
  readonly sender: FakeSender
  readonly receiver: { track: MediaStreamTrack }

  constructor(
    readonly kind: string,
    readonly madeHere: boolean,
    id: string
  ) {
    this.sender = new FakeSender(kind)
    this.receiver = { track: { kind, id } as MediaStreamTrack }
  }
}

export class FakePeerConnection {
  static made: FakePeerConnection[] = []

  signalingState: 'stable' | 'have-local-offer' | 'have-remote-offer' = 'stable'
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: FakeDescription | null = null
  remoteDescription: FakeDescription | null = null
  candidates: unknown[] = []
  rollbacks = 0
  restarts = 0
  offersMade = 0
  closed = false
  onnegotiationneeded: (() => void) | null = null
  onicecandidate: ((event: { candidate: { toJSON: () => unknown } | null }) => void) | null = null
  ontrack: ((event: { track: MediaStreamTrack; transceiver: FakeTransceiver }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  readonly transceivers: FakeTransceiver[] = []
  private descriptions = 0
  private found = 0

  constructor(readonly config: unknown) {
    FakePeerConnection.made.push(this)
  }

  addTransceiver(kind: string): FakeTransceiver {
    const made = new FakeTransceiver(kind, true, `mine-${kind}-${this.transceivers.length}`)
    this.transceivers.push(made)
    if (this.transceivers.length === LINES.length) setTimeout(() => this.onnegotiationneeded?.(), 0)
    return made
  }

  getTransceivers(): FakeTransceiver[] {
    return [...this.transceivers]
  }

  async setLocalDescription(): Promise<void> {
    if (this.signalingState === 'have-remote-offer') {
      this.localDescription = description('answer', `answer-${(this.descriptions += 1)}`)
      this.signalingState = 'stable'
      this.settle()
      this.gather()
      return
    }
    if (this.signalingState !== 'stable') throw new Error('cannot offer from this state')
    this.offersMade += 1
    for (const transceiver of this.transceivers) {
      if (transceiver.mid === null) transceiver.mid = String(this.transceivers.indexOf(transceiver))
    }
    const kinds = this.transceivers.map(t => t.kind).join(',')
    this.localDescription = description('offer', `offer-${(this.descriptions += 1)}|${kinds}`)
    this.signalingState = 'have-local-offer'
    this.gather()
  }

  // A line in an offer never lands on a transceiver this side added by hand.
  // The browser makes a fresh one for it, which is why a side that both adds
  // its own and answers ends up with two sets and listens to the wrong one.
  async setRemoteDescription(input: { type: string; sdp: string }): Promise<void> {
    if (input.type === 'offer') {
      if (this.signalingState === 'have-local-offer') {
        this.rollbacks += 1
        this.localDescription = null
        for (const transceiver of this.transceivers) {
          if (transceiver.madeHere) transceiver.mid = null
        }
      }
      const arrived: FakeTransceiver[] = []
      linesIn(input.sdp).forEach((kind, index) => {
        const mid = String(index)
        const already = this.transceivers.find(t => t.mid === mid)
        if (already) {
          arrived.push(already)
          return
        }
        const made = new FakeTransceiver(kind, false, `theirs-${kind}-${index}`)
        made.mid = mid
        made.direction = 'recvonly'
        this.transceivers.push(made)
        arrived.push(made)
      })
      this.remoteDescription = description('offer', input.sdp)
      this.signalingState = 'have-remote-offer'
      for (const transceiver of arrived) {
        this.ontrack?.({ track: transceiver.receiver.track, transceiver })
      }
      return
    }
    if (this.signalingState !== 'have-local-offer') throw new Error('no offer to answer')
    this.remoteDescription = description('answer', input.sdp)
    this.signalingState = 'stable'
    this.settle()
    for (const transceiver of this.transceivers) {
      if (transceiver.mid !== null) this.ontrack?.({ track: transceiver.receiver.track, transceiver })
    }
  }

  // The browser refuses a candidate until it has been told who it is talking
  // to, and refusing it loses it. This is strict about that on purpose.
  async addIceCandidate(candidate: unknown): Promise<void> {
    if (!this.remoteDescription) throw new Error('no remote description')
    this.candidates.push(candidate)
  }

  restartIce(): void {
    this.restarts += 1
  }

  close(): void {
    this.closed = true
  }

  emitCandidate(candidate: unknown): void {
    this.onicecandidate?.({ candidate: { toJSON: () => candidate } })
  }

  private settle(): void {
    for (const transceiver of this.transceivers) {
      if (transceiver.mid !== null) transceiver.currentDirection = transceiver.direction
    }
  }

  // A real connection starts naming its addresses the moment it has a local
  // description, well before the other end has heard of it.
  private gather(): void {
    const at = (this.found += 1)
    setTimeout(() => this.emitCandidate({ candidate: `candidate-${at}` }), 0)
  }

  setConnectionState(state: RTCPeerConnectionState): void {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }
}

class FakeMediaStream {
  private readonly tracks: MediaStreamTrack[]
  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = [...tracks]
  }
  getTracks(): MediaStreamTrack[] {
    return [...this.tracks]
  }
  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'audio')
  }
  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'video')
  }
  addTrack(track: MediaStreamTrack): void {
    if (!this.tracks.includes(track)) this.tracks.push(track)
  }
  removeTrack(track: MediaStreamTrack): void {
    const at = this.tracks.indexOf(track)
    if (at >= 0) this.tracks.splice(at, 1)
  }
}

export function installFakeRtc(): void {
  FakePeerConnection.made = []
  Object.assign(globalThis, {
    RTCPeerConnection: FakePeerConnection,
    MediaStream: FakeMediaStream
  })
}

export function fakeTrack(kind: 'audio' | 'video', id: string): MediaStreamTrack {
  return { kind, id, contentHint: '', stop: () => {} } as unknown as MediaStreamTrack
}

export const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10))
