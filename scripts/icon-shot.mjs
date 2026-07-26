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

// Not an offscreen window. Offscreen rendering waits on a paint that a page of
// static SVG never sends, and the capture hangs there forever.
const window = new BrowserWindow({
  width: 1280,
  height: Number(height),
  show: true,
  x: 0,
  y: 0
})

await window.loadFile(path.join(root, 'icon-sheet.html'))
// Nothing here waits on an animation frame. A window standing behind another one
// is throttled to almost no frames at all, and a capture that waits for one
// never comes back.
await window.webContents.executeJavaScript(`
  document.body.classList.add('keys')
  const keep = document.querySelectorAll('section')[${section}]
  for (const el of document.querySelectorAll('section, .bar, p.lede')) if (el !== keep) el.remove()
  document.title
`)
await new Promise(done => setTimeout(done, 600))

const shot = await window.webContents.capturePage()
const out = path.join(root, `icon-sheet-${section}.png`)
await writeFile(out, shot.toPNG())
console.log(out)
app.quit()
