import { create } from 'zustand'

// Which changes you have read. Reviewing a morning's work is a sitting rather
// than a glance, and the one question nobody can answer halfway through it is
// which files they have already been through. It is yours rather than the
// crew's, the way an answered question on a board is, so nothing about it is
// ever sent: two people reading the same branch each keep their own place.
//
// It is kept on this machine and it has to be. Held in the window alone, every
// reload hands back a file already read, and a renderer reloads whenever the
// project is edited under it, which is most of an afternoon with an agent
// working.

const KEY = 'crew.reviewed'
// Projects this is remembered for, and files inside one. The oldest go first,
// so a folder worked in for months is not carrying every file it ever had.
const PLACE_LIMIT = 20
const FILE_LIMIT = 400

type Read = Record<string, Record<string, string>>

// What was read is that version of it and no other. A file read and then
// written to again by an agent comes back unread, or the mark is a promise the
// screen cannot keep.
export function digestOf(text: string): string {
  let hash = 0x811c9dc5
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

// A path can stand in both lists at once, so which list it is in is part of
// what was read.
export const rowKey = (path: string, staged: boolean): string => `${staged ? 'in' : 'out'}:${path}`

const readOf = (raw: unknown): Read => {
  const held: Read = {}
  if (!raw || typeof raw !== 'object') return held
  for (const [place, files] of Object.entries(raw as Record<string, unknown>)) {
    if (!files || typeof files !== 'object') continue
    const kept: Record<string, string> = {}
    for (const [key, digest] of Object.entries(files as Record<string, unknown>)) {
      if (typeof digest === 'string') kept[key] = digest
    }
    if (Object.keys(kept).length > 0) held[place] = kept
  }
  return held
}

function load(): Read {
  try {
    return readOf(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null'))
  } catch {
    return {}
  }
}

function save(read: Read): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(read))
  } catch {
    // A window with no storage keeps them for as long as it is open, which is
    // still better than losing them while it is.
  }
}

// Whatever was written to goes to the end, so the oldest is the first to go
// rather than whichever happened to be opened first.
const trim = <T,>(held: Record<string, T>, limit: number): Record<string, T> => {
  const keys = Object.keys(held)
  if (keys.length <= limit) return held
  const next = { ...held }
  for (const old of keys.slice(0, keys.length - limit)) delete next[old]
  return next
}

const put = (read: Read, place: string, key: string, digest: string): Read => {
  const { [place]: mine, ...others } = read
  const { [key]: gone, ...rest } = mine ?? {}
  void gone
  return trim({ ...others, [place]: trim({ ...rest, [key]: digest }, FILE_LIMIT) }, PLACE_LIMIT)
}

const drop = (read: Read, place: string, key: string): Read => {
  const mine = read[place]
  if (!mine || !(key in mine)) return read
  const { [key]: gone, ...rest } = mine
  void gone
  return { ...read, [place]: rest }
}

type ReviewedState = {
  read: Read
  markRead(place: string, key: string, digest: string): void
  markUnread(place: string, key: string): void
}

export const useReviewed = create<ReviewedState>(set => ({
  read: load(),
  markRead: (place, key, digest) =>
    set(state => {
      const read = put(state.read, place, key, digest)
      save(read)
      return { read }
    }),
  markUnread: (place, key) =>
    set(state => {
      const read = drop(state.read, place, key)
      save(read)
      return { read }
    })
}))
