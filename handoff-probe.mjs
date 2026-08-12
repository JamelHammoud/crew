import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const sheet = await readFile('/Users/jamel/Documents/Repositories/crew/icon-sheet.html', 'utf8')

const pick = name => {
  const at = sheet.indexOf(`<figcaption>${name}</figcaption>`)
  const start = sheet.lastIndexOf('<figure', at)
  const end = sheet.indexOf('</figure>', at) + 9
  return sheet.slice(start, end)
}

const cards = ['Handoff', 'Branch', 'Refresh', 'Group', 'People', 'Spark', 'Link'].map(pick).join('')
const head = sheet.slice(0, sheet.indexOf('<section'))
const page = head + `<section><h2>Look</h2><div class="grid">${cards}</div></section></body></html>`

const dir = await mkdtemp(path.join(tmpdir(), 'handoff-'))
await writeFile(path.join(dir, 'page.html'), page)
await writeFile(
  path.join(dir, 'main.mjs'),
  `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 1200, height: 700 })
  await w.loadFile(path.join(import.meta.dirname, 'page.html'))
  await new Promise(r => setTimeout(r, 400))
  const img = await w.webContents.capturePage()
  writeFileSync(path.join(import.meta.dirname, 'shot.png'), img.toPNG())
  console.log('DONE')
  app.exit(0)
})`
)
const run = spawn(electron, [path.join(dir, 'main.mjs')], { stdio: 'inherit' })
run.on('exit', () => console.log(path.join(dir, 'shot.png')))
