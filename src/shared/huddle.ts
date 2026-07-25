export interface HuddlePeer {
  peerId: string
  memberId: string
  name: string
  muted: boolean
  camera: boolean
  sharing: boolean
  joinedAt: number
}

export interface HuddleRoom {
  peers: HuddlePeer[]
  startedAt: number | null
}

export type HuddleSignal =
  | { kind: 'description'; description: unknown }
  | { kind: 'candidate'; candidate: unknown }

export const MAX_HUDDLE_PEERS = 12
export const MAX_SIGNAL_CHARS = 256 * 1024
export const PEER_ID_CHARS = 64

// Public STUN only. A crew is usually on one network or on a link that already
// reaches the host, so a relay of our own would sit idle.
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
]

export function emptyRoom(): HuddleRoom {
  return { peers: [], startedAt: null }
}

// Exactly one side of a pair is polite, and that side is the one that gives way
// when both make an offer at the same time.
export function politeToward(selfPeerId: string, otherPeerId: string): boolean {
  return selfPeerId < otherPeerId
}

export function peerIn(room: HuddleRoom, peerId: string): HuddlePeer | undefined {
  return room.peers.find(peer => peer.peerId === peerId)
}

export function sharingPeer(room: HuddleRoom): HuddlePeer | undefined {
  return room.peers.find(peer => peer.sharing)
}

export function huddleTitle(room: HuddleRoom, selfPeerId: string): string {
  const others = room.peers.filter(peer => peer.peerId !== selfPeerId)
  if (others.length === 0) return 'Waiting for others'
  if (others.length === 1) return others[0].name
  if (others.length === 2) return `${others[0].name} and ${others[1].name}`
  return `${others[0].name} and ${others.length - 1} others`
}
