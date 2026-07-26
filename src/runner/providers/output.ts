const ANSI = /\[[0-9;?]*[a-zA-Z]|\][^]*|[]/g

const LINE_CHARS = 400
const HEAD_LINES = 12
const TAIL_LINES = 28

const elide = (count: number): string => `… ${count} ${count === 1 ? 'line' : 'lines'} left out`

// What a command printed, cut down to something a card can hold and a log can
// carry. The head says what it started doing and the tail says how it ended,
// which is where a failure is, so a long run loses its middle rather than
// either end.
export function commandOutput(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const clean = raw.replace(ANSI, '').replace(/[ \t]+$/gm, '').trim()
  if (!clean) return undefined
  const lines = clean.split('\n').map(line => (line.length > LINE_CHARS ? `${line.slice(0, LINE_CHARS)}…` : line))
  if (lines.length <= HEAD_LINES + TAIL_LINES + 1) return lines.join('\n')
  const head = lines.slice(0, HEAD_LINES)
  const tail = lines.slice(-TAIL_LINES)
  return [...head, elide(lines.length - head.length - tail.length), ...tail].join('\n')
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
