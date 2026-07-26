import pty from 'node-pty'
const p = pty.spawn('/Users/jamel/.local/bin/claude', ['--model','claude-opus-5','--permission-mode','bypassPermissions'], {
  name: 'xterm-256color', cols: 100, rows: 40, cwd: '/tmp/crew-think-probe', env: { ...process.env }
})
let buf = ''
p.onData(d => { buf += d; process.stdout.write(d) })
setTimeout(() => p.write('Think hard: is 91 prime? Reason it out, then answer.\r'), 4000)
setTimeout(() => {
  const hit = /Thinking|✻|Pondering|Deliberat/i.test(buf)
  console.log('\n\n=== HAS THINKING MARKER:', hit)
  const m = buf.match(/(Thinking[\s\S]{0,600})/)
  if (m) console.log('=== SAMPLE:', JSON.stringify(m[1].slice(0,600)))
  p.kill(); process.exit(0)
}, 45000)
