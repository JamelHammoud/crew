import { stripAnsi } from './output'

// The last words of a failure are the ones that say what went wrong, and a
// stack trace or a wall of warnings is not something a chat message can hold.
const KEEP_LINES = 8
const KEEP_CHARS = 600

const SIGNALS: Record<string, string> = {
  SIGKILL: 'was stopped by this machine, which usually means it ran out of memory',
  SIGTERM: 'was stopped before it finished',
  SIGINT: 'was interrupted',
  SIGHUP: 'was cut off',
  SIGSEGV: 'crashed',
  SIGBUS: 'crashed',
  SIGABRT: 'crashed',
  SIGILL: 'crashed'
}

const CODES: Record<number, string> = {
  126: 'is on this machine but could not be run',
  127: 'could not be found on this machine',
  130: 'was interrupted',
  137: 'was stopped by this machine, which usually means it ran out of memory',
  143: 'was stopped before it finished'
}

export function failureText(raw: string): string {
  const lines = stripAnsi(raw)
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, ''))
    .filter(line => line.trim())
  if (lines.length === 0) return ''
  const kept = lines.slice(-KEEP_LINES).join('\n')
  return kept.length > KEEP_CHARS ? `…${kept.slice(kept.length - KEEP_CHARS)}` : kept
}

// The last resort, for a CLI that ended without printing a word anywhere. A
// number on its own says nothing, so a code or a signal anyone can act on is
// put in words and the rest admits it does not know.
export function exitReason(label: string, code: number | null, signal: string | null): string {
  const words = (signal ? SIGNALS[signal] : '') || (code === null ? '' : CODES[code]) || ''
  if (words) return `${label} ${words}.`
  if (code === null) return `${label} stopped without saying why.`
  return `${label} stopped without saying why (exit code ${code}).`
}
