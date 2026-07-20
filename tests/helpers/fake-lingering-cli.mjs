// A CLI that leaves a child sharing its stdio pipes, the way real CLIs leave
// shells and helper servers behind. The child keeps stdout open, so the
// parent's 'close' event never fires on its own.
import { spawn } from 'node:child_process'

const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { stdio: 'inherit' })
process.stdout.write(`TEXT ${child.pid}\n`, () => {
  if (process.env.FAKE_LINGER_STAY !== '1') process.exit(0)
})
setTimeout(() => {}, 120000)
