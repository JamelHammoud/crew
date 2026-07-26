export interface Chord {
  key: string
  meta?: boolean
  shift?: boolean
  ctrl?: boolean
}

export function chordHint(chord: Chord): string {
  const marks = `${chord.ctrl ? '⌃' : ''}${chord.shift ? '⇧' : ''}${chord.meta ? '⌘' : ''}`
  return `${marks}${chord.key.toUpperCase()}`
}

export function matchesChord(event: KeyboardEvent, chord: Chord): boolean {
  if (event.key.toLowerCase() !== chord.key) return false
  if (event.metaKey !== !!chord.meta) return false
  if (event.shiftKey !== !!chord.shift) return false
  if (event.ctrlKey !== !!chord.ctrl) return false
  return !event.altKey
}

export function typingInto(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  if (el.isContentEditable) return true
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
}
