import { TIDY_RULES, type TidyRules } from './scribeTidy'

// Hold a key, talk, and what you said is written into whatever you were typing
// in. All of it runs on this machine: the model, the tidying, the paste. None of
// it is written down, none of it goes over the wire, and nothing about it
// reaches the crew, which is why every setting here lives in this window rather
// than in the log.

// Fn is not among these and cannot be. macOS keeps it below the event tap every
// app reads, so nothing outside the system is ever told it was pressed: it is
// not in the public hot key API, and libuiohook, which is how the rest of this
// is heard, has no keycode for it on any platform. Right Option is the nearest
// thing on a Mac, and it is on the built-in keyboard, which Right Control is
// not.
export type ScribeKey = 'right-option' | 'right-ctrl' | 'ctrl' | 'meta' | 'none'
export type ScribePress = 'hold' | 'toggle' | 'latch'
export type ScribeFinish = 'paste' | 'copy'

// A word whisper always hears wrong, and what it should have been. Cheap to
// build and it is what makes a dictation read as yours rather than as generic.
export interface ScribeWord {
  from: string
  to: string
}

export interface ScribeSettings {
  on: boolean
  key: ScribeKey
  press: ScribePress
  finish: ScribeFinish
  fillers: boolean
  stutters: boolean
  corrections: boolean
  marks: boolean
  // The microphone held open while Scribe is armed. It buys the front of your
  // first word and costs a recording light that is lit all day, which is a real
  // trade and belongs to whoever is sitting there.
  ready: boolean
  words: ScribeWord[]
}

// A bare modifier only becomes usable with these. The key does not arm until it
// has been held alone this long, so reaching for a shortcut never raises the
// pill, and a press let go of inside the tap window latches on rather than
// ending the moment it started.
export const ARM_MS = 180
export const TAP_MS = 250

// Long enough for a dictation nobody meant to leave running, short enough that
// the take is still a take. A latched key somebody walked away from ends here.
export const LONGEST_MS = 120_000

export const WORD_LIMIT = 200

const MAC_KEYS: ScribeKey[] = ['right-option', 'right-ctrl', 'ctrl', 'meta']
const OTHER_KEYS: ScribeKey[] = ['right-ctrl', 'ctrl', 'right-option', 'meta']

const MAC_LABELS: Record<ScribeKey, string> = {
  'right-option': 'Right Option',
  'right-ctrl': 'Right Control',
  ctrl: 'Control',
  meta: 'Command',
  none: 'Off'
}

const OTHER_LABELS: Record<ScribeKey, string> = {
  'right-option': 'Right Alt',
  'right-ctrl': 'Right Ctrl',
  ctrl: 'Ctrl',
  meta: 'Windows',
  none: 'Off'
}

const isMac = (platform: string): boolean => platform === 'darwin'

export const keyLabel = (key: ScribeKey, platform: string): string =>
  (isMac(platform) ? MAC_LABELS : OTHER_LABELS)[key] ?? MAC_LABELS.none

// Fn on a Mac because it is the one key nothing else has a claim on, and Right
// Control everywhere else for the same reason. Plain Control is offered because
// the rule that any other key cancels the take makes it safe, not because it is
// a good first answer.
export const defaultKey = (platform: string): ScribeKey => (isMac(platform) ? 'fn' : 'right-ctrl')

export const scribeKeys = (platform: string): ScribeKey[] => (isMac(platform) ? MAC_KEYS : OTHER_KEYS)

// A combination that is registered the ordinary way and stays live whatever the
// low level hook is doing. The hook is the good key and this is the one that
// cannot go quiet, so there is always a way to dictate.
export const fallbackCombo = (platform: string): string =>
  isMac(platform) ? 'Control+Command+Space' : 'Control+Alt+Space'

export const fallbackLabel = (platform: string): string =>
  isMac(platform) ? 'Control Command Space' : 'Ctrl Alt Space'

export function defaultSettings(platform: string): ScribeSettings {
  return {
    on: false,
    key: defaultKey(platform),
    press: 'latch',
    finish: 'paste',
    fillers: true,
    stutters: true,
    corrections: true,
    marks: true,
    ready: false,
    words: []
  }
}

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const one = <T extends string>(value: unknown, of: readonly T[], fallback: T): T =>
  typeof value === 'string' && (of as readonly string[]).includes(value) ? (value as T) : fallback

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

// What arrives is only ever as good as what checks it. These come back off
// storage written by an older build, or by hand, so nothing is taken on trust.
function cleanWords(input: unknown): ScribeWord[] {
  if (!Array.isArray(input)) return []
  const out: ScribeWord[] = []
  const seen = new Set<string>()
  for (const row of input) {
    if (!row || typeof row !== 'object') continue
    const from = text((row as ScribeWord).from)
    const to = text((row as ScribeWord).to)
    const key = from.toLowerCase()
    if (!from || !to || seen.has(key)) continue
    seen.add(key)
    out.push({ from, to })
    if (out.length === WORD_LIMIT) break
  }
  return out
}

export function cleanSettings(input: unknown, platform: string): ScribeSettings {
  const base = defaultSettings(platform)
  if (!input || typeof input !== 'object') return base
  const held = input as Partial<ScribeSettings>
  const keys = [...scribeKeys(platform), 'none' as const]
  return {
    on: bool(held.on, base.on),
    key: one(held.key, keys, base.key),
    press: one(held.press, ['hold', 'toggle', 'latch'] as const, base.press),
    finish: one(held.finish, ['paste', 'copy'] as const, base.finish),
    fillers: bool(held.fillers, base.fillers),
    stutters: bool(held.stutters, base.stutters),
    corrections: bool(held.corrections, base.corrections),
    marks: bool(held.marks, base.marks),
    ready: bool(held.ready, base.ready),
    words: cleanWords(held.words)
  }
}

export function rulesOf(settings: ScribeSettings): TidyRules {
  return {
    ...TIDY_RULES,
    fillers: settings.fillers,
    stutters: settings.stutters,
    corrections: settings.corrections,
    marks: settings.marks,
    words: settings.words
  }
}

export type { TidyRules }
