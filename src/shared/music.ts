// The music a crew can put on. A tune is a few numbers, and the app plays it out
// of the same bubbles the rest of its sounds are made of. The only other thing
// it will play is a file somebody in the crew put there themselves.

export interface MusicTune {
  id: string
  name: string
  // One word for what it is like, which is all a row has space for.
  mood: string
  bpm: number
  // How long the loop is, in beats. The tune is written against these two.
  beats: number
  // The five colors the cover is made of. The first three are the petals, the
  // fourth is the light along their lit edges, and the last is the sky they
  // stand against. They are the tune heard as a picture, so a fast one is hot
  // and a slow one is cool.
  //
  // None of them is dark. A cover is a thing photographed close up in good
  // light, and the darkest place in a picture like that is a color in shade,
  // never an ink: a near black anywhere in the palette lands as a bruise in the
  // corner of the tile, and every cover carrying one reads as the same picture.
  // The sky is the one to watch, since it is the color most of the frame is.
  //
  // And none of the first three is a near white either, which is the same
  // mistake at the other end. Those three are the things in the frame, and a
  // thing has a color: pale enough and there is no color left in it, so it
  // stops being the light on a petal and becomes a hole cut in the picture,
  // brighter than everything around it and made of nothing. Every palette here
  // carried one as its middle color, which is why the white shape in a cover
  // read as belonging to a different picture. The fourth is the light itself and
  // is meant to be near white.
  colors: readonly [string, string, string, string, string]
}

export const MUSIC_TUNES = [
  {
    id: 'overworld',
    name: 'Overworld',
    mood: 'bouncy',
    bpm: 132,
    beats: 32,
    colors: ['#6fe9ff', '#a5dcff', '#7cf0a8', '#f4fdff', '#2f9dfa']
  },
  {
    id: 'arcade',
    name: 'Arcade',
    mood: 'busy',
    bpm: 150,
    beats: 32,
    colors: ['#ff7ac8', '#ffb0dc', '#8fd8ff', '#fff0fa', '#ff3fae']
  },
  {
    id: 'tide-pool',
    name: 'Tide Pool',
    mood: 'floating',
    bpm: 84,
    beats: 32,
    colors: ['#5fe6c8', '#7fecd0', '#ffcf8f', '#f4fffb', '#9fe9dd']
  },
  {
    id: 'night-bus',
    name: 'Night Bus',
    mood: 'mellow',
    bpm: 96,
    beats: 32,
    colors: ['#b98cff', '#ffb0e0', '#ffc98f', '#f6efff', '#8a7cf0']
  },
  {
    id: 'star-road',
    name: 'Star Road',
    mood: 'soaring',
    bpm: 120,
    beats: 32,
    colors: ['#9fc4ff', '#b0ccff', '#ffd166', '#f7faff', '#5b9bf5']
  },
  {
    id: 'hearth',
    name: 'Hearth',
    mood: 'cosy',
    bpm: 88,
    beats: 32,
    colors: ['#ffb15c', '#ffcb8f', '#9fcbe0', '#fff5e6', '#f59440']
  },
  {
    id: 'rain-check',
    name: 'Rain Check',
    mood: 'wistful',
    bpm: 76,
    beats: 32,
    colors: ['#a8d4ff', '#b0cdf0', '#f0aec4', '#f6faff', '#7fa8e0']
  },
  {
    id: 'sprint',
    name: 'Sprint',
    mood: 'hurried',
    bpm: 168,
    beats: 32,
    colors: ['#ffc23d', '#ffd47a', '#8fe0ff', '#fff6e0', '#ff5a2e']
  },
  {
    id: 'bubble-bath',
    name: 'Bubble Bath',
    mood: 'silly',
    bpm: 108,
    beats: 32,
    colors: ['#ff9ed8', '#ffb8e0', '#ffc48f', '#fff4fa', '#7fe8d0']
  },
  {
    id: 'deep-dive',
    name: 'Deep Dive',
    mood: 'murky',
    bpm: 92,
    beats: 32,
    colors: ['#4fe0d0', '#7ff0dc', '#8fe87f', '#eafffb', '#2a9fc4']
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    mood: 'hopeful',
    bpm: 104,
    beats: 32,
    colors: ['#ffcf5c', '#ffb8cd', '#ffa87f', '#fff8ea', '#4fa8f5']
  },
  {
    id: 'snowfield',
    name: 'Snowfield',
    mood: 'still',
    bpm: 72,
    beats: 32,
    colors: ['#b5d8f5', '#8fb5e0', '#ffcb94', '#fbfdff', '#a8cdf0']
  },
  {
    id: 'boss-fight',
    name: 'Boss Fight',
    mood: 'fierce',
    bpm: 160,
    beats: 32,
    colors: ['#ffb03d', '#ffb894', '#a8b0ff', '#fff2e6', '#f5462e']
  },
  {
    id: 'lobby',
    name: 'Lobby',
    mood: 'patient',
    bpm: 112,
    beats: 32,
    colors: ['#a8f05c', '#b0e87f', '#5fe8b0', '#f6ffea', '#6fc0f5']
  },
  {
    id: 'credits',
    name: 'Credits',
    mood: 'fond',
    bpm: 100,
    beats: 32,
    colors: ['#ff9ec4', '#ffbcd8', '#ffc98f', '#fff4f8', '#b08ce8']
  }
] as const satisfies readonly MusicTune[]

export type MusicTuneId = (typeof MUSIC_TUNES)[number]['id']

// Something a member of the crew put there. It is kept the way an attachment is,
// beside the session rather than in it, and everyone plays their own copy.
export interface MusicUpload {
  id: string
  name: string
  file: string
  seconds: number
  by: string
  ts: number
}

// A tune and an upload are one thing to everything downstream: a row in the
// list, a cover, and something the player can be handed.
export interface MusicItem {
  id: string
  name: string
  mood: string
  seconds: number
  colors: readonly string[]
  bpm: number
  // Only an upload has one. A tune is played out of its own notes.
  file?: string
  by?: string
}

// A list somebody made for themselves, out of what is already on the shelf. It
// holds ids rather than tracks, so a playlist is the order it was written in and
// nothing else. Unlike what is playing, this lasts.
export interface MusicPlaylist {
  id: string
  name: string
  // Whoever made it. Only they can change it, and everyone can play it.
  by: string
  trackIds: string[]
  ts: number
}

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
  // The playlist this track was put on from, if it came from one. It is what
  // Next and Back walk along, so a playlist plays through rather than falling
  // back into the shelf after its first track.
  playlistId: string | null
}

export const BY_LIMIT = 40
export const UPLOAD_NAME_LIMIT = 60
export const MAX_UPLOAD_BYTES = 24 * 1024 * 1024
export const MAX_UPLOADS = 40
export const MAX_UPLOAD_SECONDS = 60 * 60
export const PLAYLIST_NAME_LIMIT = 40
export const MAX_PLAYLISTS = 60
export const MAX_PLAYLIST_TRACKS = 200

const UPLOAD_FILE = /^[a-z0-9-]+\.(mp3|m4a|ogg|wav|flac)$/

export const AUDIO_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac'
}

export function audioExtension(mime: string): string | null {
  return AUDIO_TYPES[mime] ?? null
}

export function isUploadFile(file: string): boolean {
  return UPLOAD_FILE.test(file)
}

export function mimeForMusic(file: string): string {
  const extension = file.split('.').pop() ?? ''
  const found = Object.entries(AUDIO_TYPES).find(([, value]) => value === extension)
  return found ? found[0] : 'application/octet-stream'
}

export function uploadUrl(httpBase: string, file: string): string {
  return `${httpBase}/music/${file}`
}

export function emptyMusic(): MusicRoom {
  return { trackId: null, playing: false, at: 0, by: '', playlistId: null }
}

// An upload has no picture of its own, so it is given one that is always the
// same for the same track: everyone's list looks alike, and two uploads are told
// apart at a glance.
const SHELVES: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['#ff8fa8', '#ffc09f', '#8fd4e8', '#fff2e8', '#f56b8a'],
  ['#8ce68f', '#a0e88f', '#ffd98f', '#f2fff4', '#7fd4f0'],
  ['#8fb8ff', '#b0c9f5', '#ffc9a8', '#f4f8ff', '#4f8ef5'],
  ['#c48fff', '#d4b0ff', '#9ff0d8', '#faf2ff', '#a87ae8'],
  ['#ffc85c', '#ffd07a', '#8fc4f0', '#fff8e6', '#f5943c'],
  ['#5fe0f0', '#94e0f5', '#ffbf9f', '#eefbff', '#3fa8e0']
]

export function paletteFor(seed: string): readonly string[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return SHELVES[hash % SHELVES.length]
}

export function tuneLength(tune: MusicTune): number {
  return (tune.beats * 60) / tune.bpm
}

const itemOf = (tune: MusicTune): MusicItem => ({
  id: tune.id,
  name: tune.name,
  mood: tune.mood,
  seconds: tuneLength(tune),
  colors: tune.colors,
  bpm: tune.bpm
})

// An upload keeps a beat of its own for the bars to stand on. Nothing has read
// the file to find the real one, so this is a plain steady pulse rather than a
// guess dressed up as one.
const UPLOAD_BPM = 100

const uploadItem = (upload: MusicUpload): MusicItem => ({
  id: upload.id,
  name: upload.name,
  mood: 'yours',
  seconds: upload.seconds,
  colors: paletteFor(upload.id),
  bpm: UPLOAD_BPM,
  file: upload.file,
  by: upload.by
})

export const TUNE_ITEMS: readonly MusicItem[] = MUSIC_TUNES.map(itemOf)

export function musicItems(uploads: readonly MusicUpload[] = []): MusicItem[] {
  return [...TUNE_ITEMS, ...uploads.map(uploadItem)]
}

export function itemFor(id: string | null | undefined, uploads: readonly MusicUpload[] = []): MusicItem | null {
  const tune = MUSIC_TUNES.find(one => one.id === id)
  if (tune) return itemOf(tune)
  const upload = uploads.find(one => one.id === id)
  return upload ? uploadItem(upload) : null
}

export function tuneFor(id: string | null | undefined): MusicTune | null {
  return MUSIC_TUNES.find(tune => tune.id === id) ?? null
}

// A loop has no end to fall off, so a position past the end of one pass is the
// same position on the next.
export function wrapAt(at: number, seconds: number): number {
  if (!Number.isFinite(at) || seconds <= 0) return 0
  const round = at % seconds
  return round < 0 ? round + seconds : round
}

export function trackAfter(id: string | null, step: number, uploads: readonly MusicUpload[] = []): string {
  const items = musicItems(uploads)
  const at = items.findIndex(item => item.id === id)
  const next = (at + step + items.length) % items.length
  return items[at === -1 ? 0 : next].id
}

export function cleanUploadName(name: string): string {
  const trimmed = name.trim().replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, UPLOAD_NAME_LIMIT)
  return trimmed || 'Untitled'
}
