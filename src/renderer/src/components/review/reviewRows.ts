import { diffRows, type Row } from '../diffRows'

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

// What a change reads as when the whole point is reading it. `rowsOf` keeps the
// lines that moved and throws the rest away, which is the right answer for a
// step in a thread, where a diff is a glance at what an agent did. Here it is
// the work itself: a line with nothing around it cannot be judged, and two
// stretches four hundred lines apart run together as though they were
// neighbours. So the lines git already sent are kept, the boundary between one
// stretch and the next is a row of its own, and every line carries where it
// really sits in the file.
//
// `line` stays what the highlighter reads: a count over the rows kept here, so
// the document handed to shiki is the one being drawn. `at` is the file's own
// number and is only ever shown. Read the other way round, a file whose first
// stretch starts at line 400 hands the highlighter four hundred lines it does
// not have and every row loses its colour.
export function reviewRows(diff: string): Row[] {
  const rows: Row[] = []
  let line = 0
  let at = 0
  let started = false
  let gone: string[] = []
  let made: string[] = []

  const settle = () => {
    if (gone.length === 0 && made.length === 0) return
    const paired =
      gone.length === 0
        ? made.map(text => ({ text, line: 0, changed: true, inner: [] }))
        : made.length === 0
          ? gone.map(text => ({ text, line: null, changed: true, inner: [] }))
          : diffRows(gone.join('\n'), made.join('\n'))
    for (const row of paired) {
      if (row.line === null) {
        rows.push({ ...row, line: null })
        continue
      }
      line += 1
      rows.push({ ...row, line, at })
      at += 1
    }
    gone = []
    made = []
  }

  for (const raw of diff.split('\n')) {
    const head = HUNK.exec(raw)
    if (head) {
      settle()
      // The first stretch opens the reading rather than interrupting it, so
      // only the ones after it stand a row for what was skipped.
      if (started) rows.push({ text: '', line: null, changed: false, inner: [], gap: true })
      started = true
      at = Number(head[1])
      continue
    }
    // Everything before the first stretch is git talking about the file, and
    // the row above the diff already says which file this is.
    if (!started) continue
    const mark = raw[0]
    // A file that ends without a newline says so on a line of its own.
    if (mark === '\\') continue
    if (mark === '-') {
      gone.push(raw.slice(1))
      continue
    }
    if (mark === '+') {
      made.push(raw.slice(1))
      continue
    }
    if (mark !== ' ' && raw !== '') continue
    settle()
    line += 1
    rows.push({ text: raw.slice(1), line, at, changed: false, inner: [] })
    at += 1
  }
  settle()
  return rows
}
