import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Puts the sheet in front of a real renderer and takes its picture, so the set
// can be looked at rather than only measured. A number says a shape sits on its
// keyline. It does not say the arc went the wrong way round.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const [, , section = '0', height = '2400'] = process.argv

await app.whenReady()

const window = new BrowserWindow({
  width: 1280,
  height: Number(height),
  show: false,
  webPreferences: { offscreen: true }
})

await window.loadFile(path.join(root, 'icon-sheet.html'))
await window.webContents.executeJavaScript(`
  document.body.classList.add('keys')
  const keep = document.querySelectorAll('section')[${section}]
  for (const el of document.querySelectorAll('section, .bar, p.lede')) if (el !== keep) el.remove()
  new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
`)

const shot = await window.webContents.capturePage()
const out = path.join(root, `icon-sheet-${section}.png`)
await writeFile(out, shot.toPNG())
console.log(out)
app.quit()
