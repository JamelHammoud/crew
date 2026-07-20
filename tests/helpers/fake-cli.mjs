const prompt = (process.argv[2] ?? '').replace(/\s+/g, ' ')
const delay = Number(process.env.FAKE_CLI_DELAY_MS ?? 20)
const fail = process.env.FAKE_CLI_FAIL === '1'
const withActivity = process.env.FAKE_CLI_ACTIVITY === '1'
const withThinking = process.env.FAKE_CLI_THINK === '1'

const rest = process.argv.slice(3).join(' ')

const lines = []
if (rest) lines.push(`TEXT flags: ${rest}`)
if (withThinking) lines.push('THINK weighing the options')
if (withActivity) {
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
