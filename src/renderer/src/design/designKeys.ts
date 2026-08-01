export interface Chord {
  key: string
  meta?: boolean
  shift?: boolean
  ctrl?: boolean
  alt?: boolean
}

const MARKS: Record<string, string> = {
  backspace: '⌫',
  enter: '↩',
  escape: 'Esc'
}

const BASE_KEYS: Record<string, string> = {
  Digit0: '0',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Minus: '-',
  Equal: '='
}

export function chordHint(chord: Chord): string {
  const marks = `${chord.ctrl ? '⌃' : ''}${chord.alt ? '⌥' : ''}${chord.shift ? '⇧' : ''}${chord.meta ? '⌘' : ''}`
  return `${marks}${MARKS[chord.key] ?? chord.key.toUpperCase()}`
}

export function matchesChord(event: KeyboardEvent, chord: Chord): boolean {
  const accel = event.metaKey || event.ctrlKey
  if (!!chord.meta !== accel) return false
  if (!!chord.ctrl !== (event.metaKey && event.ctrlKey)) return false
  if (event.shiftKey !== !!chord.shift) return false
  if (event.altKey !== !!chord.alt) return false
  if (event.key.toLowerCase() === chord.key) return true
  return BASE_KEYS[event.code] === chord.key
}

export function typingInto(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  if (el.isContentEditable) return true
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
}

export const BOARD_CHAT_MARK = 'data-board-chat'

export function keyIsTheBoards(target: EventTarget | null): boolean {
  if (typingInto(target)) return false
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return true
  return el.closest(`[${BOARD_CHAT_MARK}]`) === null
}
