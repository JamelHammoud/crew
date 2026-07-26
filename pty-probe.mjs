import pty from 'node-pty'
const env = { ...process.env }
delete env.CLAUDE_CODE_CHILD_SESSION
delete env.CLAUDECODE
delete env.CLAUDE_CODE_ENTRYPOINT
const p = pty.spawn('/Users/jamel/.local/bin/claude', ['--model','claude-opus-5','--permission-mode','bypassPermissions'], {
  name: 'xterm-256color', cols: 100, rows: 40, cwd: '/tmp/crew-think-probe', env
})
let buf = ''
p.onData(d => { buf += d })
setTimeout(() => p.write('\r'), 3000)
setTimeout(() => p.write('Think hard: is 91 prime? Reason it out fully, then answer.'), 7000)
setTimeout(() => p.write('\r'), 9000)
setTimeout(() => {
  const plain = buf.replace(/\x1b\[[0-9;:?]*[a-zA-Z]/g,'').replace(/\x1b\][^\x07]*\x07/g,'')
  console.log('=== markers:', ['Thinking','Pondering','✻','Deliberating'].filter(w => plain.includes(w)))
  const i = plain.search(/Thinking[…\.]/)
  console.log('=== sample:', i >= 0 ? JSON.stringify(plain.slice(i, i+500)) : 'none')
  p.kill(); process.exit(0)
}, 60000)
