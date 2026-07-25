// A stand-in for the browser's connection that keeps the parts the negotiation
// depends on honest: which descriptions a signaling state will accept, and the
// rollback that happens when an offer arrives on top of one already sent.

export interface FakeDescription {
  type: 'offer' | 'answer'
  sdp: string
  toJSON: () => { type: string; sdp: string }
}

function description(type: 'offer' | 'answer', sdp: string): FakeDescription {
  return { type, sdp, toJSON: () => ({ type, sdp }) }
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

export class FakePeerConnection {
  static made: FakePeerConnection[] = []

  signalingState: 'stable' | 'have-local-offer' | 'have-remote-offer' = 'stable'
  connectionState: RTCPeerConnectionState = 'new'
  localDescription: FakeDescription | null = null
  remoteDescription: FakeDescription | null = null
  candidates: unknown[] = []
  rollbacks = 0
  restarts = 0
  closed = false
  onnegotiationneeded: (() => void) | null = null
  onicecandidate: ((event: { candidate: { toJSON: () => unknown } | null }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  readonly transceivers: Array<{ sender: FakeSender; receiver: { track: MediaStreamTrack } }> = []
  private offers = 0
  private found = 0

  constructor(readonly config: unknown) {
    FakePeerConnection.made.push(this)
  }

  addTransceiver(kind: string): { sender: FakeSender; receiver: { track: MediaStreamTrack } } {
    const entry = {
      sender: new FakeSender(kind),
      receiver: { track: { kind, id: `${kind}-${this.transceivers.length}` } as MediaStreamTrack }
    }
    this.transceivers.push(entry)
    if (this.transceivers.length === 3) setTimeout(() => this.onnegotiationneeded?.(), 0)
    return entry
  }

  async setLocalDescription(): Promise<void> {
    if (this.signalingState === 'have-remote-offer') {
      this.localDescription = description('answer', `answer-${(this.offers += 1)}`)
      this.signalingState = 'stable'
      this.gather()
      return
    }
    if (this.signalingState !== 'stable') throw new Error('cannot offer from this state')
    this.localDescription = description('offer', `offer-${(this.offers += 1)}`)
    this.signalingState = 'have-local-offer'
    this.gather()
  }

  async setRemoteDescription(input: { type: string; sdp: string }): Promise<void> {
    if (input.type === 'offer') {
      if (this.signalingState === 'have-local-offer') {
        this.rollbacks += 1
        this.localDescription = null
      }
      this.remoteDescription = description('offer', input.sdp)
      this.signalingState = 'have-remote-offer'
      return
    }
    if (this.signalingState !== 'have-local-offer') throw new Error('no offer to answer')
    this.remoteDescription = description('answer', input.sdp)
    this.signalingState = 'stable'
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
  constructor(readonly tracks: MediaStreamTrack[] = []) {}
  getAudioTracks(): MediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'audio')
  }
  getVideoTracks(): MediaStreamTrack[] {
    return this.tracks.filter(track => track.kind === 'video')
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
