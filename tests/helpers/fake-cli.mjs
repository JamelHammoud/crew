const prompt = (process.argv[2] ?? '').replace(/\s+/g, ' ')
const delay = Number(process.env.FAKE_CLI_DELAY_MS ?? 20)
const fail = process.env.FAKE_CLI_FAIL === '1'
const withActivity = process.env.FAKE_CLI_ACTIVITY === '1'
const withThinking = process.env.FAKE_CLI_THINK === '1'
const withStreamedThinking = process.env.FAKE_CLI_THINK_STREAM === '1'
const withStreamedText = process.env.FAKE_CLI_TEXT_STREAM === '1'
const withOutput = process.env.FAKE_CLI_OUTPUT === '1'
// Lines of `USAGE`/`TOTAL`, one per newline, for a run that has to report what
// its tokens came to.
const usage = process.env.FAKE_CLI_USAGE ?? ''
const echoPrompt = process.env.FAKE_CLI_ECHO_PROMPT === '1'

const rest = process.argv.slice(3).join(' ')

const lines = []
if (echoPrompt) lines.push(`TEXT prompt: ${prompt}`)
if (rest) lines.push(`TEXT flags: ${rest}`)
if (withThinking) lines.push('THINK weighing the options')
if (withStreamedThinking) {
  lines.push('THINKSTART 0')
  lines.push('THINKDELTA 0 weighing ')
  lines.push('THINKDELTA 0 the options')
  lines.push('BLOCKSTOP 0')
  // A block that arrives with nothing in it, the way a model that is asked to
  // keep its reasoning to itself sends one.
  lines.push('THINKSTART 1')
  lines.push('THINKDELTA 1 ')
  lines.push('BLOCKSTOP 1')
}
// The reply as a real CLI sends it: deltas on the way, then the whole block
// again once it closes.
if (withStreamedText) {
  lines.push('TEXTSTART 0')
  lines.push('TEXTDELTA 0 the answer ')
  lines.push('TEXTDELTA 0 in pieces')
  lines.push('TEXT the answer in pieces')
  lines.push('BLOCKSTOP 0')
} else if (withOutput) {
  lines.push('ACT t2 tool Bash ls -la')
  lines.push('OUT t2 total 8 drwxr-xr-x 4 jamel staff 128 src')
  lines.push('ACT t3 tool Read src/index.ts')
  lines.push('OUT t3 every line of the file')
} else if (withActivity) {
  lines.push('ACT a1 subagent Helper researching the question')
  lines.push('ACT t1 tool Glob *.md')
  lines.push('TEXT fake[')
  lines.push('END t1')
  lines.push(`TEXT ${prompt}`)
  lines.push('END a1')
  lines.push('TEXT ]')
} else {
  lines.push('TEXT fake[')
  lines.push(`TEXT ${prompt}`)
  lines.push('TEXT ]')
}
for (const line of usage.split('\n')) if (line.trim()) lines.push(line.trim())

let i = 0
function tick() {
  if (i < lines.length) {
    process.stdout.write(lines[i++] + '\n')
    setTimeout(tick, delay)
    return
  }
  if (fail) {
    process.stderr.write('fake cli failed\n')
    process.exit(1)
  }
  process.exit(0)
}
tick()
