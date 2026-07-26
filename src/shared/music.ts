// The music a crew can put on. Nothing here points at a file or a service: a
// track is a few numbers, and the app plays it out of the same bubbles the rest
// of its sounds are made of. There is nothing else it can be asked to play.

export interface MusicTrack {
  id: string
  name: string
  // One word for what it is like, which is all a row has space for.
  mood: string
  bpm: number
  // How long the loop is, in beats. The tune is written against these two.
  beats: number
}

export const MUSIC_TRACKS = [
  { id: 'overworld', name: 'Overworld', mood: 'bouncy', bpm: 132, beats: 32 },
  { id: 'arcade', name: 'Arcade', mood: 'busy', bpm: 150, beats: 32 },
  { id: 'tide-pool', name: 'Tide Pool', mood: 'floating', bpm: 84, beats: 32 },
  { id: 'night-bus', name: 'Night Bus', mood: 'mellow', bpm: 96, beats: 32 }
] as const satisfies readonly MusicTrack[]

export type MusicTrackId = (typeof MUSIC_TRACKS)[number]['id']

// What everyone connected is hearing. It rides in the session snapshot and in
// music.room, never in the event log, so putting something on is not a thing the
// crew has to scroll past later.
export interface MusicRoom {
  trackId: string | null
  playing: boolean
  // Seconds into the loop at the moment this was sent. Every machine takes it
  // from here on its own audio clock, so nobody has to trust anyone else's.
  at: number
  // Whoever last put a hand on it.
  by: string
}

export const BY_LIMIT = 40

export function emptyMusic(): MusicRoom {
  return { trackId: null, playing: false, at: 0, by: '' }
}

export function trackFor(id: string | null | undefined): MusicTrack | null {
  return MUSIC_TRACKS.find(track => track.id === id) ?? null
}

export function trackLength(track: MusicTrack): number {
  return (track.beats * 60) / track.bpm
}

// A loop has no end to fall off, so a position past the end of one pass is the
// same position on the next.
export function wrapAt(at: number, track: MusicTrack): number {
  const length = trackLength(track)
  if (!Number.isFinite(at) || length <= 0) return 0
  const round = at % length
  return round < 0 ? round + length : round
}

export function trackAfter(id: string | null, step: number): MusicTrackId {
  const at = MUSIC_TRACKS.findIndex(track => track.id === id)
  const next = (at + step + MUSIC_TRACKS.length) % MUSIC_TRACKS.length
  return MUSIC_TRACKS[at === -1 ? 0 : next].id
}
