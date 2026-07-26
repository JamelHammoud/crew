import { expect, it } from 'vitest'
import { Terminals } from '../src/main/terminal'

it('claims a real login shell with no end of line mark left over', async () => {
  const made = new Terminals()
  made.warm(process.cwd())
  const started = Date.now()
  while (!made.ready() && Date.now() - started < 20000) {
    await new Promise(r => setTimeout(r, 50))
  }
  expect(made.ready()).toBe(true)

  let text = ''
  made.open('probe', process.cwd(), { cols: 110, rows: 30 }, {
    data: (_id, chunk) => void (text += chunk),
    exit: () => undefined
  })
  console.log('SHELL', process.env['SHELL'], 'warmed in ms', Date.now() - started)
  console.log('ON SCREEN', JSON.stringify(text))
  expect(text.length).toBeGreaterThan(0)
  expect(/\[7m%/.test(text)).toBe(false)
  made.closeAll()
})
