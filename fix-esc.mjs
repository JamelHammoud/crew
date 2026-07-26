import { readFileSync, writeFileSync } from 'node:fs'

const file = 'tests/terminal.integration.test.ts'
const lines = readFileSync(file, 'utf8').split('\n')
const at = lines.findIndex(line => line.includes('const held ='))
if (at < 0) throw new Error('anchor not found')
lines.splice(
  at,
  2,
  "    const mark = '\\u001b[1m\\u001b[7m%\\u001b[27m\\u001b[1m\\u001b[0m'",
  "    const prompt = '\\u001b[0m\\u001b[Jjamel@crew % \\u001b[K\\u001b[?2004h'",
  "    expect(replayable(`${mark}${' '.repeat(79)}\\r \\r\\r${prompt}`)).toBe(prompt)"
)
writeFileSync(file, lines.join('\n'))
console.log('rewrote lines', at + 1, 'to', at + 2)
