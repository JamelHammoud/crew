import { localUrl, OLLAMA_PORT, serverUrl } from './modelServers'
import type { Editor } from './scribeEdit'
import { TIDY_RULES, type TidyRules } from './scribeTidy'

// Hold a key, talk, and what you said is written into whatever you were typing
// in. All of it runs on this machine: the model, the tidying, the paste. None of
// it is written down, none of it goes over the wire, and nothing about it
// reaches the crew, which is why every setting here lives in this window rather
// than in the log.

export type ScribeKey = 'fn' | 'right-option' | 'right-ctrl' | 'ctrl' | 'meta' | 'none'
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
  always: boolean
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
  // Written as it is said rather than all at once at the end. There is nothing
  // to hand over once this is on, which is why the pill has no way to finish on
  // it: the key started the dictation and the key ends it.
  live: boolean
  edit: boolean
  editUrl: string
  editModel: string
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

// The pill, and the room its shadow needs. A window ends where its bounds end,
// so a drop thrown from a pill that fills its own window is cut off flat at all
// four sides, which reads as a pale oblong standing behind the pill rather than
// as a shadow under it. The window is the pill plus ROOM on every side, that
// room is empty and see-through, and the shadow in `.glass-pill` is written to
// land inside it.
export const PILL_ROOM = 32

// The widest the pill ever gets, which is a failure: that is the one state that
// holds a sentence, and it is the only one that asks for the room to hold it.
// Everything a failure has to say is what to do about it, and a sentence clamped
// halfway through is a pill that says something went wrong and nothing else, so
// this is the width three readable lines want rather than the width the rest of
// the pill would like.
//
// The window is built this wide and comes down to whatever the pill really is a
// beat later, so nothing is ever drawn past its own window on the way up.
export const PILL_WIDTH = 260

// The pill stands on screen the whole time dictation is on, so what it is at
// rest is the size it is nearly always at: the mark and nothing else, small
// enough to be somewhere it can be left. It grows the moment there is something
// to hear and comes back down after, and it grows by its top edge, so the
// bottom of it never moves.
export const PILL_REST = 28
export const PILL_MAX = 120

// A dictation that had nowhere to go is held on a card rather than on the pill,
// because the words themselves are the whole of what it has to say and a pill is
// the width of a mark. It is wider than a failure and taller than anything else
// here, and the words scroll inside it past that height: what was said is however
// long somebody talked for, and a card as tall as a paragraph would stand over
// half of whatever it is floating on.
// The words get their own ceiling rather than the card's, because the card is the
// two rows around them as well, and a box grown to the whole of the card's height
// would push those rows past the window the card is drawn in and be cut off flat.
export const HELD_WIDTH = 300
export const HELD_WORDS = 120
export const HELD_MAX = 232

// The app must not hear its own paste. That keystroke goes out through the same
// hook the key is read with, so a dictation held on Command, or on Control where
// Control is what pastes, would be ended by the words it was writing on the way
// past. Anything arriving this soon after one was sent is the app's own.
export const OWN_MS = 150

export const ownKey = (sent: number, now: number): boolean => sent > 0 && now - sent < OWN_MS

const MAC_KEYS: ScribeKey[] = ['fn', 'right-option', 'right-ctrl', 'ctrl', 'meta']
const OTHER_KEYS: ScribeKey[] = ['right-ctrl', 'ctrl', 'right-option', 'meta']

const MAC_LABELS: Record<ScribeKey, string> = {
  fn: 'Fn',
  'right-option': 'Right Option',
  'right-ctrl': 'Right Control',
  ctrl: 'Control',
  meta: 'Command',
  none: 'Off'
}

const OTHER_LABELS: Record<ScribeKey, string> = {
  fn: 'Fn',
  'right-option': 'Right Alt',
  'right-ctrl': 'Right Ctrl',
  ctrl: 'Ctrl',
  meta: 'Windows',
  none: 'Off'
}

const isMac = (platform: string): boolean => platform === 'darwin'

export const keyLabel = (key: ScribeKey, platform: string): string =>
  (isMac(platform) ? MAC_LABELS : OTHER_LABELS)[key] ?? MAC_LABELS.none

// The right hand modifier almost nothing else has a claim on, either way round.
// Plain Control is offered because the rule that any other key cancels the take
// makes it safe, not because it is a good first answer.
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
    always: false,
    key: defaultKey(platform),
    press: 'latch',
    finish: 'paste',
    fillers: true,
    stutters: true,
    corrections: true,
    marks: true,
    ready: false,
    live: true,
    edit: false,
    editUrl: localUrl(OLLAMA_PORT),
    editModel: '',
    words: []
  }
}

const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

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
    always: bool(held.always, base.always),
    key: one(held.key, keys, base.key),
    press: one(held.press, ['hold', 'toggle', 'latch'] as const, base.press),
    finish: one(held.finish, ['paste', 'copy'] as const, base.finish),
    fillers: bool(held.fillers, base.fillers),
    stutters: bool(held.stutters, base.stutters),
    corrections: bool(held.corrections, base.corrections),
    marks: bool(held.marks, base.marks),
    ready: bool(held.ready, base.ready),
    live: bool(held.live, base.live),
    edit: bool(held.edit, base.edit),
    editUrl: typeof held.editUrl === 'string' ? (serverUrl(held.editUrl) ?? '') : base.editUrl,
    editModel: text(held.editModel),
    words: cleanWords(held.words)
  }
}

// What the key is really doing, as opposed to what it was asked to do. On
// Windows the low level hook can go quiet once a microphone opens, and on macOS
// it needs Accessibility, so both are said on the settings page rather than left
// to be worked out from a key that does nothing.
export interface ScribeKeyState {
  hooked: boolean
  trusted: boolean
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

export function editorOf(settings: ScribeSettings): Editor {
  return { url: settings.edit ? settings.editUrl : '', model: settings.editModel }
}

export const restsOnScreen = (settings: ScribeSettings): boolean => settings.on && settings.always

export type { TidyRules }
