import { spawn } from 'node:child_process'

const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { stdio: 'inherit' })
process.stdout.write(`TEXT ${child.pid}\n`, () => {
  if (process.env.FAKE_LINGER_STAY !== '1') process.exit(0)
})
setTimeout(() => {}, 120000)
