import { spawn } from 'node-pty'

const p = spawn(process.env.SHELL || '/bin/zsh', ['-l'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: { ...process.env, TERM: 'xterm-256color' }
})
let held = ''
p.onData(c => (held += c))
setTimeout(() => {
  const flat = held
    .split('\r\n')
    .map(line => line.slice(line.lastIndexOf('\r') + 1))
    .join('\r\n')
  console.log('RAW ', JSON.stringify(held))
  console.log('FLAT', JSON.stringify(flat))
  p.kill()
  process.exit(0)
}, 5000)
