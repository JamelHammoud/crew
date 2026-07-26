import { create } from 'zustand'
import {
  emptyMusic,
  trackAfter,
  trackFor,
  wrapAt,
  type MusicRoom,
  type MusicTrack
} from '../../../shared/music'
import { MusicPlayer } from '../media/music'
import { onMusic, sendMusic, useCrew } from './store'
import { onSounds, soundsOn } from './sound'

const VOLUME_KEY = 'crew.music.volume'
const MUTED_KEY = 'crew.music.muted'

// How far out of step this machine has to be before it is worth jumping. A room
// that says what is already happening leaves the music alone, so a message that
// changes nothing is not a hiccup in everyone's speakers.
const DRIFT = 0.35

export interface MusicState {
  room: MusicRoom
  // The moment the room landed here, so the bar keeps moving on a machine that
  // is not playing anything: muted, or with the app's sounds turned off.
  since: number
  volume: number
  muted: boolean
  track: () => MusicTrack | null
  position: () => number
  put: (trackId: string) => void
  toggle: () => void
  skip: (step: number) => void
  seek: (at: number) => void
  off: () => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
}

const stored = (key: string, fallback: number): number => {
  const held = Number(globalThis.localStorage?.getItem(key))
  return Number.isFinite(held) && held >= 0 && held <= 1 ? held : fallback
}

export const useMusic = create<MusicState>((set, get) => {
  const player = new MusicPlayer()

  const level = (): number => (get().muted ? 0 : get().volume)

  // What everyone is hearing is a track and a place in it. Whether this machine
  // is the one that asked for it makes no difference to how it is played.
  const settle = (): void => {
    const room = get().room
    const track = trackFor(room.trackId)
    if (!track || !room.playing || !soundsOn()) {
      player.stop()
      return
    }
    const inStep = player.running() && player.trackId === track.id
    if (inStep && Math.abs(player.position() - room.at) <= DRIFT) return
    player.play(track, room.at)
    player.setVolume(level())
  }

  onMusic(msg => {
    set({ room: msg.room, since: Date.now() })
    settle()
  })

  onSounds(() => settle())

  // Leaving the session takes the music with it. Nothing is playing for a crew
  // you are no longer in.
  let connection = useCrew.getState().connection
  useCrew.subscribe(state => {
    const before = connection
    connection = state.connection
    if (before === connection || connection !== 'home') return
    player.stop()
    set({ room: emptyMusic(), since: Date.now() })
  })

  return {
    room: emptyMusic(),
    since: Date.now(),
    volume: stored(VOLUME_KEY, 0.7),
    muted: globalThis.localStorage?.getItem(MUTED_KEY) === 'on',

    track: () => trackFor(get().room.trackId),

    // Where the loop has got to. The player's own clock while it is playing, and
    // where the room said it was plus however long ago that was when it is not.
    position: () => {
      const { room, since } = get()
      const track = trackFor(room.trackId)
      if (!track) return 0
      if (player.running()) return player.position()
      const run = room.playing ? (Date.now() - since) / 1000 : 0
      return wrapAt(room.at + run, track)
    },

    put: trackId => sendMusic({ type: 'music.set', trackId, playing: true, at: 0 }),

    toggle: () => {
      const room = get().room
      if (!room.trackId) {
        get().put(trackAfter(null, 1))
        return
      }
      sendMusic({ type: 'music.set', trackId: room.trackId, playing: !room.playing, at: get().position() })
    },

    skip: step => {
      const room = get().room
      const trackId = trackAfter(room.trackId, step)
      sendMusic({ type: 'music.set', trackId, playing: room.trackId ? room.playing : true, at: 0 })
    },

    seek: at => {
      const room = get().room
      if (!room.trackId) return
      sendMusic({ type: 'music.set', trackId: room.trackId, playing: room.playing, at })
    },

    off: () => sendMusic({ type: 'music.off' }),

    setVolume: volume => {
      const held = Math.min(1, Math.max(0, volume))
      globalThis.localStorage?.setItem(VOLUME_KEY, String(held))
      set({ volume: held, muted: held === 0 ? get().muted : false })
      player.setVolume(get().muted ? 0 : held)
    },

    setMuted: muted => {
      globalThis.localStorage?.setItem(MUTED_KEY, muted ? 'on' : 'off')
      set({ muted })
      player.setVolume(muted ? 0 : get().volume)
    }
  }
})
