// A fake CLI that behaves like `claude --input-format stream-json`: it reads
// user messages off stdin as JSON lines, folds any that arrive mid-turn into
// the turn in flight, and ends each turn with a RESULT line.
const delay = Number(process.env.FAKE_CLI_DELAY_MS ?? 20)

let buffer = ''
let turnActive = false
let stdinEnded = false
const absorbed = []

function endTurn(prompt) {
  for (const text of absorbed.splice(0)) process.stdout.write(`TEXT steered:${text}\n`)
  process.stdout.write(`TEXT ${prompt}\n`)
  process.stdout.write('TEXT ]\n')
  process.stdout.write('RESULT\n')
  turnActive = false
  if (stdinEnded) setTimeout(() => process.exit(0), 10)
}

function startTurn(prompt) {
  turnActive = true
  process.stdout.write('TEXT fake[\n')
  setTimeout(() => endTurn(prompt), delay)
}

function onMessage(line) {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  const text = (msg?.message?.content ?? [])
    .filter(block => block?.type === 'text')
    .map(block => block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return
  if (turnActive) absorbed.push(text)
  else startTurn(text)
}

process.stdin.on('data', chunk => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''
  for (const line of lines) if (line.trim()) onMessage(line)
})

process.stdin.on('end', () => {
  stdinEnded = true
  if (!turnActive) setTimeout(() => process.exit(0), 10)
})
