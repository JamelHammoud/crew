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
  // The four colors the cover is mixed from, warmest first. They are the tune
  // heard as a picture: bright and high for a fast one, deep for a slow one.
  colors: readonly [string, string, string, string]
}

export const MUSIC_TUNES = [
  {
    id: 'overworld',
    name: 'Overworld',
    mood: 'bouncy',
    bpm: 132,
    beats: 32,
    colors: ['#ffd166', '#5ac8fa', '#7cf5c0', '#2a6df4']
  },
  {
    id: 'arcade',
    name: 'Arcade',
    mood: 'busy',
    bpm: 150,
    beats: 32,
    colors: ['#ff5f6d', '#ffc371', '#8a5cff', '#22d3ee']
  },
  {
    id: 'tide-pool',
    name: 'Tide Pool',
    mood: 'floating',
    bpm: 84,
    beats: 32,
    colors: ['#33d6c8', '#2a6df4', '#a5f3d0', '#0f4c81']
  },
  {
    id: 'night-bus',
    name: 'Night Bus',
    mood: 'mellow',
    bpm: 96,
    beats: 32,
    colors: ['#8a5cff', '#ff8fb1', '#3b2a6b', '#f7c873']
  },
  {
    id: 'star-road',
    name: 'Star Road',
    mood: 'soaring',
    bpm: 120,
    beats: 32,
    colors: ['#c7a6ff', '#57e2ff', '#fff1a8', '#3a2a8c']
  },
  {
    id: 'hearth',
    name: 'Hearth',
    mood: 'cosy',
    bpm: 88,
    beats: 32,
    colors: ['#ffb37b', '#ff7a59', '#ffe0b2', '#7a3b2e']
  },
  {
    id: 'rain-check',
    name: 'Rain Check',
    mood: 'wistful',
    bpm: 76,
    beats: 32,
    colors: ['#9db4d8', '#4a6fa5', '#cfe3f7', '#243b5e']
  },
  {
    id: 'sprint',
    name: 'Sprint',
    mood: 'hurried',
    bpm: 168,
    beats: 32,
    colors: ['#ff4d6d', '#ffd166', '#ff8c42', '#5b0e2d']
  },
  {
    id: 'bubble-bath',
    name: 'Bubble Bath',
    mood: 'silly',
    bpm: 108,
    beats: 32,
    colors: ['#7cf5c0', '#ffd6f5', '#5ac8fa', '#2f8f83']
  },
  {
    id: 'deep-dive',
    name: 'Deep Dive',
    mood: 'murky',
    bpm: 92,
    beats: 32,
    colors: ['#1f6f8b', '#0b2545', '#4cc9b0', '#08304f']
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    mood: 'hopeful',
    bpm: 104,
    beats: 32,
    colors: ['#ffb86b', '#ff7eb3', '#ffe9a8', '#6a4bbc']
  },
  {
    id: 'snowfield',
    name: 'Snowfield',
    mood: 'still',
    bpm: 72,
    beats: 32,
    colors: ['#dbeafe', '#a8c8ec', '#f0f7ff', '#3f5f8a']
  },
  {
    id: 'boss-fight',
    name: 'Boss Fight',
    mood: 'fierce',
    bpm: 160,
    beats: 32,
    colors: ['#ff3b5c', '#7c1f3d', '#ffb020', '#1a0b1f']
  },
  {
    id: 'lobby',
    name: 'Lobby',
    mood: 'patient',
    bpm: 112,
    beats: 32,
    colors: ['#a3d9c9', '#f6e7b4', '#7fb3d5', '#37605c']
  },
  {
    id: 'credits',
    name: 'Credits',
    mood: 'fond',
    bpm: 100,
    beats: 32,
    colors: ['#ffd6a5', '#b8e0ff', '#ffadad', '#4b3f72']
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
export const UPLOAD_NAME_LIMIT = 60
export const MAX_UPLOAD_BYTES = 24 * 1024 * 1024
export const MAX_UPLOADS = 40
export const MAX_UPLOAD_SECONDS = 60 * 60

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
  return { trackId: null, playing: false, at: 0, by: '' }
}

// An upload has no picture of its own, so it is given one that is always the
// same for the same track: everyone's list looks alike, and two uploads are told
// apart at a glance.
const SHELVES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['#ff9a76', '#ff5f9e', '#ffd166', '#5b2a86'],
  ['#7ee8c2', '#3ba2a0', '#e7f9a9', '#12463f'],
  ['#8ec5ff', '#5b7cfa', '#d6e4ff', '#1f2a63'],
  ['#ffc6ff', '#a06cd5', '#ffe6ff', '#432371'],
  ['#ffe066', '#f7a072', '#fff3c4', '#7f4f24'],
  ['#9bf6ff', '#4361ee', '#caf0f8', '#03045e']
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
