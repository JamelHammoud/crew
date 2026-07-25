import { create } from 'zustand'
import { emptyRoom, peerIn, sharingPeer, type HuddleRoom } from '../../../shared/huddle'
import type { MediaKind } from '../../../shared/media'
import { chimeJoin, chimeLeave } from '../media/chime'
import { captureCamera, captureMic, captureScreen, stop } from '../media/capture'
import { HuddleMesh } from '../media/mesh'
import type { SlotStreams, SlotTracks } from '../media/peer'
import { SpeakingMonitor } from '../media/speaking'
import { onHuddle, sendHuddle, useCrew } from './store'

const PROBLEMS: Record<MediaKind, string> = {
  microphone: 'crew could not reach your microphone. Check its permission in System Settings.',
  camera: 'crew could not reach your camera. Check its permission in System Settings.',
  screen: 'crew could not capture your screen. Check its permission in System Settings.'
}

export interface HuddleState {
  room: HuddleRoom
  peerId: string
  joined: boolean
  joining: boolean
  // Set once the server has shown this client in the room it asked to join.
  confirmed: boolean
  micOn: boolean
  cameraOn: boolean
  sharing: boolean
  expanded: boolean
  picking: boolean
  speaking: string[]
  problem: MediaKind | null
  localCamera: MediaStream | null
  localScreen: MediaStream | null
  remote: Record<string, SlotStreams>
  link: Record<string, RTCPeerConnectionState>
  join: () => Promise<void>
  leave: () => void
  toggleMic: () => Promise<void>
  toggleCamera: () => Promise<void>
  share: (sourceId: string) => Promise<void>
  stopSharing: () => void
  setPicking: (picking: boolean) => void
  setExpanded: (expanded: boolean) => void
  clearProblem: () => void
  openSettings: () => void
}

const tracks: SlotTracks = { mic: null, camera: null, screen: null }

const newPeerId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `peer-${Math.random().toString(36).slice(2)}-${Date.now()}`

export const useHuddle = create<HuddleState>((set, get) => {
  const mesh = new HuddleMesh({
    send: (to, signal) => sendHuddle({ type: 'huddle.signal', to, signal }),
    onChange: () => refreshStreams()
  })
  const monitor = new SpeakingMonitor(speaking => set({ speaking }))

  const refreshStreams = () => {
    const remote: Record<string, SlotStreams> = {}
    const link: Record<string, RTCPeerConnectionState> = {}
    for (const peer of get().room.peers) {
      if (peer.peerId === get().peerId) continue
      const streams = mesh.streamsOf(peer.peerId)
      if (!streams) continue
      remote[peer.peerId] = streams
      link[peer.peerId] = mesh.stateOf(peer.peerId) ?? 'new'
      monitor.watch(peer.peerId, streams.mic)
    }
    for (const peerId of Object.keys(get().remote)) {
      if (!remote[peerId]) monitor.unwatch(peerId)
    }
    set({ remote, link })
  }

  const publish = () => {
    mesh.publish(tracks)
    if (tracks.mic) monitor.watch(get().peerId, new MediaStream([tracks.mic]))
  }

  const announce = () => {
    const { micOn, cameraOn, sharing } = get()
    sendHuddle({ type: 'huddle.update', muted: !micOn, camera: cameraOn, sharing })
  }

  const teardown = () => {
    mesh.close()
    monitor.close()
    for (const slot of ['mic', 'camera', 'screen'] as const) {
      stop(tracks[slot])
      tracks[slot] = null
    }
    set({
      joined: false,
      joining: false,
      micOn: false,
      cameraOn: false,
      sharing: false,
      expanded: false,
      picking: false,
      localCamera: null,
      localScreen: null,
      remote: {},
      link: {},
      speaking: []
    })
  }

  onHuddle(msg => {
    if (msg.type === 'huddle.signal') {
      mesh.accept(msg.from, msg.signal)
      return
    }
    const before = get().room
    const wasHere = new Set(before.peers.map(peer => peer.peerId))
    const self = get().peerId
    const mine = peerIn(msg.room, self)
    set({ room: msg.room, confirmed: get().confirmed || mine !== undefined })
    // Once the server has shown this client in the room, a roster without it is
    // the call saying it moved on. Before that, it is only a roster that has not
    // caught up with the join yet.
    if (get().joined && get().confirmed && !mine) {
      teardown()
      set({ room: msg.room })
      return
    }
    if (get().joined) {
      if (get().sharing && mine && !mine.sharing) get().stopSharing()
      for (const peer of msg.room.peers) {
        if (peer.peerId !== self && !wasHere.has(peer.peerId)) chimeJoin()
      }
      for (const peer of before.peers) {
        if (peer.peerId !== self && !peerIn(msg.room, peer.peerId)) chimeLeave()
      }
      mesh.sync(self, msg.room.peers.map(peer => peer.peerId))
      const shared = sharingPeer(msg.room)
      if (shared && shared.peerId !== self) set({ expanded: true })
    }
    refreshStreams()
  })

  // A reconnect keeps the peer connections alive, so rejoining under the same
  // peer id puts this client back in the room it never really left. Leaving the
  // session entirely ends the call.
  let connection = useCrew.getState().connection
  useCrew.subscribe(state => {
    const before = connection
    connection = state.connection
    if (before === connection) return
    if (connection === 'home' && get().joined) {
      teardown()
      set({ room: emptyRoom() })
      return
    }
    if (connection === 'online' && get().joined) {
      const { peerId, micOn, cameraOn } = get()
      set({ confirmed: false })
      sendHuddle({ type: 'huddle.join', peerId, muted: !micOn, camera: cameraOn })
      announce()
    }
  })

  return {
    room: emptyRoom(),
    peerId: newPeerId(),
    joined: false,
    joining: false,
    micOn: false,
    cameraOn: false,
    sharing: false,
    expanded: false,
    picking: false,
    speaking: [],
    problem: null,
    localCamera: null,
    localScreen: null,
    remote: {},
    link: {},

    // Joining never blocks on a device. Someone whose microphone is busy or
    // blocked still gets into the call, muted, and can fix it from there.
    join: async () => {
      if (get().joined || get().joining) return
      set({ joining: true, problem: null })
      const mic = await captureMic()
      tracks.mic = mic.track
      const peerId = get().peerId
      set({ joined: true, joining: false, micOn: mic.track !== null, problem: mic.problem })
      sendHuddle({ type: 'huddle.join', peerId, muted: mic.track === null, camera: false })
      mesh.sync(peerId, get().room.peers.map(peer => peer.peerId))
      publish()
      refreshStreams()
    },

    leave: () => {
      if (!get().joined) return
      sendHuddle({ type: 'huddle.leave' })
      teardown()
    },

    toggleMic: async () => {
      if (!get().joined) return
      if (get().micOn) {
        stop(tracks.mic)
        tracks.mic = null
        monitor.unwatch(get().peerId)
        set({ micOn: false })
        publish()
        announce()
        return
      }
      const mic = await captureMic()
      tracks.mic = mic.track
      set({ micOn: mic.track !== null, problem: mic.problem })
      publish()
      announce()
    },

    toggleCamera: async () => {
      if (!get().joined) return
      if (get().cameraOn) {
        stop(tracks.camera)
        tracks.camera = null
        set({ cameraOn: false, localCamera: null })
        publish()
        announce()
        return
      }
      const camera = await captureCamera()
      tracks.camera = camera.track
      set({
        cameraOn: camera.track !== null,
        localCamera: camera.track ? new MediaStream([camera.track]) : null,
        problem: camera.problem
      })
      publish()
      announce()
    },

    share: async sourceId => {
      if (!get().joined) return
      set({ picking: false })
      const screen = await captureScreen(sourceId)
      if (!screen.track) {
        set({ problem: screen.problem })
        return
      }
      stop(tracks.screen)
      tracks.screen = screen.track
      // Stopping from the operating system's own share bar ends it too.
      screen.track.addEventListener('ended', () => get().stopSharing())
      set({ sharing: true, localScreen: new MediaStream([screen.track]), expanded: false, problem: null })
      publish()
      announce()
    },

    stopSharing: () => {
      if (!get().sharing) return
      stop(tracks.screen)
      tracks.screen = null
      set({ sharing: false, localScreen: null })
      publish()
      announce()
    },

    setPicking: picking => set({ picking }),
    setExpanded: expanded => set({ expanded }),
    clearProblem: () => set({ problem: null }),
    openSettings: () => {
      const problem = get().problem
      if (problem) void globalThis.window?.crew?.openMediaSettings(problem)
      set({ problem: null })
    }
  }
})

export function problemText(problem: MediaKind): string {
  return PROBLEMS[problem]
}
