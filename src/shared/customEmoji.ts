// Emoji the crew drew themselves. One is a picture kept beside the session and
// written as `:name:` wherever an emoji goes, so it reacts to a message, sits in
// a line of chat and stands in the picker beside the ones the sheet ships with.
// It belongs to everyone here: whoever adds one, everyone gets it.

export interface CustomEmoji {
  id: string
  name: string
  file: string
  by: string
  ts: number
}

// A GIF is the whole point of half of them, so it is first among equals rather
// than the exception. Everything here is a picture a browser draws on its own.
export const CUSTOM_EMOJI_TYPES: Record<string, string> = {
  'image/gif': 'gif',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/apng': 'png'
}

export const MAX_CUSTOM_EMOJI = 300

// One is drawn at 22 across in the picker and 17 in a row, so a megabyte is
// already far more picture than any of them needs. It is its own number rather
// than the crew's file limit: that one is about what people send each other, and
// a folder of a hundred animated pictures every machine pulls is a different
// question from one big file sent once.
export const CUSTOM_EMOJI_MAX_BYTES = 1024 * 1024

export const CUSTOM_EMOJI_NAME_LIMIT = 32

const NAME = /^[a-z0-9][a-z0-9_+-]*$/
const FILE = /^[a-z0-9-]+\.(gif|png|webp|jpg)$/
const REF = /^:([a-z0-9][a-z0-9_+-]*):$/

// What a `:name:` looks like inside a sentence. The tokenizer and the DOM walk
// both read prose with it, so it is written down once here.
export const CUSTOM_EMOJI_SCAN = /:([a-z0-9][a-z0-9_+-]*):/g

export function customEmojiExtension(mime: string): string | null {
  return CUSTOM_EMOJI_TYPES[mime] ?? null
}

export function isCustomEmojiFile(file: string): boolean {
  return FILE.test(file)
}

export function mimeForCustomEmoji(file: string): string {
  const extension = file.split('.').pop() ?? ''
  const found = Object.entries(CUSTOM_EMOJI_TYPES).find(([, value]) => value === extension)
  return found ? found[0] : 'application/octet-stream'
}

// The name is the whole of what somebody types to reach it, so what they meant
// is taken rather than refused: the case, the colons they wrapped it in and the
// spaces they left in the middle are all read as the name underneath. What is
// left has to be a name, or there is nothing to write.
export function cleanCustomEmojiName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const bare = name
    .trim()
    .toLowerCase()
    .replace(/^:+|:+$/g, '')
    .replace(/[\s.]+/g, '_')
    .replace(/[^a-z0-9_+-]/g, '')
    .replace(/^[_+-]+/, '')
    .slice(0, CUSTOM_EMOJI_NAME_LIMIT)
  return NAME.test(bare) ? bare : null
}

// A name taken from the file it arrived as, for the field to open on. The
// extension is not part of it and neither is the version somebody's downloads
// folder added.
export function customEmojiNameFromFile(fileName: string): string {
  return cleanCustomEmojiName(fileName.replace(/\.[a-z0-9]{1,12}$/i, '').replace(/[-\s]*\(\d+\)$/, '')) ?? ''
}

export function customEmojiRef(name: string): string {
  return `:${name}:`
}

// The name inside a `:name:`, for a value that is the whole of one and nothing
// else. A reaction is one of those, and so is what the picker hands back.
export function customEmojiNameIn(value: string): string | null {
  return REF.exec(value)?.[1] ?? null
}

export function isCustomEmojiRef(value: string): boolean {
  return REF.test(value)
}

export function customEmojiUrl(httpBase: string, file: string): string {
  return `${httpBase}/emoji/${file}`
}

export function findCustomEmoji(list: readonly CustomEmoji[], name: string): CustomEmoji | undefined {
  return list.find(emoji => emoji.name === name)
}

// A name means one thing for the whole crew, so a second picture cannot take a
// name that is already answering to something.
export function customEmojiNameTaken(list: readonly CustomEmoji[], name: string): boolean {
  return list.some(emoji => emoji.name === name)
}
