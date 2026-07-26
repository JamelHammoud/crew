import { register } from 'node:module'
register('tsx/esm', import.meta.url)

const { Terminals } = await import('./src/main/terminal.ts')

const made = new Terminals()
made.warm(process.cwd())

const wait = ms => new Promise(r => setTimeout(r, ms))
const started = Date.now()
while (!made.ready() && Date.now() - started < 15000) await wait(50)

let text = ''
const claimed = Date.now()
made.open('probe', process.cwd(), { cols: 110, rows: 30 }, {
  data: (_id, chunk) => (text += chunk),
  exit: () => undefined
})
console.log('warmed in ms:', claimed - started)
console.log('on screen at open:', JSON.stringify(text))
console.log('has end of line mark:', /\[7m%/.test(text))
made.closeAll()
process.exit(0)
