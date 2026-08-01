const { spawn } = require('node-pty')
const { execFileSync } = require('node:child_process')
const kids = () => {
  try { return execFileSync('pgrep', ['-P', String(process.pid)], { encoding: 'utf8' }).trim().split('\n').filter(Boolean) }
  catch { return [] }
}
console.log('before', kids())
const a = spawn('/bin/sh', ['-l'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd(), env: { ...process.env, TERM: 'xterm-256color' } })
const b = spawn('/bin/sh', ['-l'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: '/tmp', env: { ...process.env, TERM: 'xterm-256color' } })
setTimeout(() => {
  console.log('pids', a.pid, b.pid)
  console.log('after spawn', kids())
  a.kill(); b.kill()
  setTimeout(() => {
    console.log('after kill', kids())
    console.log('alive a?', alive(a.pid), 'alive b?', alive(b.pid))
    process.exit(0)
  }, 600)
}, 800)
function alive(pid) { try { process.kill(pid, 0); return true } catch { return false } }
