// Colors, cursor moves and the noise a progress bar leaves behind. A card is
// not a terminal, so none of it survives the trip.
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*(?:\u0007|\u001b\\)|\r(?!\n)|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g

const LINE_CHARS = 400
const HEAD_LINES = 12
const TAIL_LINES = 28
const MAX_CHARS = 4000

export const stripAnsi = (text: string): string => text.replace(ANSI, '')

const elide = (count: number): string => `… ${count} ${count === 1 ? 'line' : 'lines'} left out`

const clip = (line: string): string => (line.length > LINE_CHARS ? `${line.slice(0, LINE_CHARS)}…` : line)

// What a command printed, cut down to something a card can hold and a log the
// whole crew syncs can carry. The head says what it set out to do and the tail
// says how it ended, which is where a failure is, so a long run loses its
// middle rather than either end.
export function commandOutput(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const clean = stripAnsi(raw).replace(/[ \t]+$/gm, '').trim()
  if (!clean) return undefined
  const lines = clean.split('\n').map(clip)
  const whole = lines.join('\n')
  if (lines.length <= HEAD_LINES + TAIL_LINES && whole.length <= MAX_CHARS) return whole

  const head = lines.slice(0, HEAD_LINES)
  let tail = lines.slice(Math.max(HEAD_LINES, lines.length - TAIL_LINES))
  const kept = () => [...head, elide(lines.length - head.length - tail.length), ...tail].join('\n')
  while (kept().length > MAX_CHARS && tail.length > 1) tail = tail.slice(1)
  while (kept().length > MAX_CHARS && head.length > 1) head.pop()
  return kept()
}

// Claude and Kimi hand back either a plain string or the content blocks the
// model saw, so both are read down to the text before being cut.
export function resultText(content: unknown): string | undefined {
  if (typeof content === 'string') return commandOutput(content)
  if (!Array.isArray(content)) return undefined
  const text = content
    .map(block => (typeof block === 'string' ? block : typeof block?.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
  return commandOutput(text)
}
