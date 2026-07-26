const t0 = Date.now()
const pty = await import('node-pty')
const loaded = Date.now() - t0

const shell = process.env.SHELL || '/bin/zsh'
const t1 = Date.now()
const p = pty.spawn(shell, ['-l'], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
})
let first = null
let promptAt = null
let bytes = 0
p.onData(chunk => {
  bytes += chunk.length
  if (first === null) first = Date.now() - t1
  if (promptAt === null && /\[\?2004h/.test(chunk)) promptAt = Date.now() - t1
})
setTimeout(() => {
  console.log(JSON.stringify({ nodePtyLoadMs: loaded, shell, firstByteMs: first, promptMs: promptAt, bytes }))
  p.kill()
  process.exit(0)
}, 6000)
