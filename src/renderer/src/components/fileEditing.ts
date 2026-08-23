export interface FileEdit {
  value: string
  start: number
  end: number
}

const INDENT = '  '

const lineStart = (value: string, at: number): number => value.lastIndexOf('\n', Math.max(0, at - 1)) + 1

const selectedLines = (value: string, start: number, end: number): { from: number; to: number } => {
  const from = lineStart(value, start)
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end
  const next = value.indexOf('\n', last)
  return { from, to: next < 0 ? value.length : next }
}

export function indentFile(value: string, start: number, end: number, out: boolean): FileEdit {
  if (start === end && !out) {
    const next = value.slice(0, start) + INDENT + value.slice(end)
    return { value: next, start: start + INDENT.length, end: start + INDENT.length }
  }

  const range = selectedLines(value, start, end)
  const lines = value.slice(range.from, range.to).split('\n')
  let removedBeforeStart = 0
  let delta = 0
  let at = range.from
  const changed = lines.map(line => {
    if (!out) {
      delta += INDENT.length
      at += line.length + 1
      return INDENT + line
    }
    const take = line.startsWith('\t') ? 1 : Math.min(INDENT.length, line.match(/^ */)?.[0].length ?? 0)
    if (at < start) removedBeforeStart += take
    delta -= take
    at += line.length + 1
    return line.slice(take)
  })
  const next = value.slice(0, range.from) + changed.join('\n') + value.slice(range.to)
  const nextStart = Math.max(range.from, start + (out ? -removedBeforeStart : INDENT.length))
  const nextEnd = Math.max(nextStart, end + delta)
  return { value: next, start: nextStart, end: nextEnd }
}

export function breakFileLine(value: string, start: number, end: number): FileEdit {
  const from = lineStart(value, start)
  const indent = value.slice(from, start).match(/^\s*/)?.[0] ?? ''
  const before = value.slice(from, start).trimEnd()
  const spaces = value.slice(end).match(/^[\t ]*/)?.[0].length ?? 0
  const tail = end + spaces
  const after = value.slice(tail).match(/^[^\n]*/)?.[0].trimStart() ?? ''
  const opens = /[{[(]$/.test(before)
  const closes = /^[}\])]/.test(after)
  const inner = opens ? indent + INDENT : indent
  const put = opens && closes ? `\n${inner}\n${indent}` : `\n${inner}`
  const next = value.slice(0, start) + put + value.slice(tail)
  const at = start + inner.length + 1
  return { value: next, start: at, end: at }
}
