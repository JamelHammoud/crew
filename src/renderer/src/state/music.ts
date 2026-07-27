import { create } from 'zustand'
import {
  emptyMusic,
  itemFor,
  musicItems,
  trackAfter,
  tuneFor,
  uploadUrl,
  wrapAt,
  type MusicItem,
  type MusicPlaylist,
  type MusicRoom,
  type MusicUpload
} from '../../../shared/music'
import { levelsAt } from '../media/levels'
import { MusicPlayer } from '../media/music'
import { tuneLevels } from '../media/tunes'
import { onMusic, onMusicPlaylists, onMusicShelf, sendMusic, useCrew } from './store'
import { onSounds, soundsOn } from './sound'

const VOLUME_KEY = 'crew.music.volume'
const MUTED_KEY = 'crew.music.muted'

// How far out of step this machine has to be before it is worth jumping. A room
// that says what is already happening leaves the music alone, so a message that
// changes nothing is not a hiccup in everyone's speakers.
const DRIFT = 0.35

export interface MusicState {
  room: MusicRoom
  uploads: MusicUpload[]
  playlists: MusicPlaylist[]
  // The moment the room landed here, so the bar keeps moving on a machine that
  // is not playing anything: muted, or with the app's sounds turned off.
  since: number
  volume: number
  muted: boolean
  adding: boolean
  // What is wrong with the track that is on, if anything. A track that will not
  // load here sounds exactly like one playing quietly, so it has to be said.
  trouble: string | null
  track: () => MusicItem | null
  items: () => MusicItem[]
  playlist: (playlistId: string | null) => MusicPlaylist | null
  position: () => number
  levels: (count: number, into: number[]) => number[]
  put: (trackId: string, playlistId?: string | null) => void
  toggle: () => void
  skip: (step: number) => void
  seek: (at: number) => void
  off: () => void
  add: (file: File) => Promise<string | null>
  remove: (trackId: string) => void
  makePlaylist: (name: string) => void
  dropPlaylist: (playlistId: string) => void
  holdTrack: (playlistId: string, trackId: string, on: boolean) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
}

const stored = (key: string, fallback: number): number => {
  const held = Number(globalThis.localStorage?.getItem(key))
  return Number.isFinite(held) && held >= 0 && held <= 1 ? held : fallback
}

// A file the browser can read is one the app can play, so its length is asked
// of the browser rather than guessed at from the size of it.
const secondsOf = (file: File): Promise<number> =>
  new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const probe = new Audio()
    const done = (seconds: number) => {
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : 0)
    probe.onerror = () => done(0)
    probe.src = url
  })

const base64Of = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('unreadable'))
    reader.readAsDataURL(file)
  })

export const useMusic = create<MusicState>((set, get) => {
  const player = new MusicPlayer()

  const level = (): number => (get().muted ? 0 : get().volume)

  // What everyone is hearing is a track and a place in it. Whether this machine
  // is the one that asked for it makes no difference to how it is played.
  const settle = (): void => {
    const room = get().room
    const track = itemFor(room.trackId, get().uploads)
    if (!track || !room.playing || !soundsOn()) {
      player.stop()
      set({ trouble: null })
      return
    }
    const inStep = player.running() && player.trackId === track.id
    if (inStep && Math.abs(player.position() - room.at) <= DRIFT) return
    const tune = tuneFor(track.id)
    if (tune) {
      player.play(tune, room.at)
      set({ trouble: null })
    } else if (track.file) {
      const url = uploadUrl(useCrew.getState().httpBase, track.file)
      set({ trouble: null })
      void player.playFile(track.id, url, track.seconds, room.at).then(result => {
        if (result === 'unplayable') set({ trouble: 'This track will not play here' })
      })
    }
    player.setVolume(level())
  }

  onMusic(msg => {
    set({ room: msg.room, since: Date.now() })
    settle()
  })

  onMusicShelf(uploads => {
    set({ uploads })
    settle()
  })

  onMusicPlaylists(playlists => set({ playlists }))

  onSounds(() => settle())

  // Leaving the session takes the music with it. Nothing is playing for a crew
  // you are no longer in.
  let connection = useCrew.getState().connection
  useCrew.subscribe(state => {
    const before = connection
    connection = state.connection
    if (before === connection || connection !== 'home') return
    player.stop()
    set({ room: emptyMusic(), uploads: [], playlists: [], since: Date.now(), trouble: null })
  })

  return {
    room: emptyMusic(),
    uploads: [],
    playlists: [],
    since: Date.now(),
    volume: stored(VOLUME_KEY, 0.7),
    muted: globalThis.localStorage?.getItem(MUTED_KEY) === 'on',
    adding: false,
    trouble: null,

    track: () => itemFor(get().room.trackId, get().uploads),

    items: () => musicItems(get().uploads),

    playlist: playlistId => get().playlists.find(one => one.id === playlistId) ?? null,

    // Where the loop has got to. The player's own clock while it is playing, and
    // where the room said it was plus however long ago that was when it is not.
    position: () => {
      const { room, since } = get()
      const track = itemFor(room.trackId, get().uploads)
      if (!track) return 0
      if (player.running()) return player.position()
      const run = room.playing ? (Date.now() - since) / 1000 : 0
      return wrapAt(room.at + run, track.seconds)
    },

    // What the bars stand at. The music itself where it is playing, and the
    // tune's own shape where it is not, so a muted machine watches the same
    // dance as everyone else rather than a flat line.
    levels: (count, into) => {
      const heard = player.levels(count)
      if (heard) {
        for (let band = 0; band < count; band++) into[band] = heard[band]
        return into
      }
      const room = get().room
      const tune = tuneFor(room.trackId)
      if (!tune) return into.fill(0)
      const held = levelsAt(tuneLevels(tune, count), get().position(), into)
      if (room.playing) return held
      for (let band = 0; band < count; band++) held[band] *= 0.45
      return held
    },

    // A track put on from a playlist carries the list it came from, so Next and
    // Back walk that list rather than the whole shelf.
    put: (trackId, playlistId = null) =>
      sendMusic({ type: 'music.set', trackId, playing: true, at: 0, playlistId }),

    toggle: () => {
      const room = get().room
      if (!room.trackId) {
        get().put(trackAfter(null, 1, get().uploads))
        return
      }
      sendMusic({
        type: 'music.set',
        trackId: room.trackId,
        playing: !room.playing,
        at: get().position(),
        playlistId: room.playlistId
      })
    },

    skip: step => {
      const room = get().room
      const within = get().playlist(room.playlistId)
      const trackId = trackAfter(room.trackId, step, get().uploads, within)
      sendMusic({
        type: 'music.set',
        trackId,
        playing: room.trackId ? room.playing : true,
        at: 0,
        playlistId: room.playlistId
      })
    },

    seek: at => {
      const room = get().room
      if (!room.trackId) return
      sendMusic({ type: 'music.set', trackId: room.trackId, playing: room.playing, at, playlistId: room.playlistId })
    },

    off: () => sendMusic({ type: 'music.off' }),

    // Adding a track hands the file to the host, which keeps it beside the
    // session. What comes back is what everyone else will play.
    add: async file => {
      set({ adding: true })
      try {
        const seconds = await secondsOf(file)
        if (!seconds) return 'That file will not play here'
        const data = await base64Of(file)
        if (!data) return 'That file could not be read'
        sendMusic({ type: 'music.add', name: file.name, mime: file.type, seconds, data })
        return null
      } catch {
        return 'That file could not be read'
      } finally {
        set({ adding: false })
      }
    },

    remove: trackId => sendMusic({ type: 'music.remove', trackId }),

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
