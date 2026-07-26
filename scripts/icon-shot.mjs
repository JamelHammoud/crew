import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Puts the sheet in front of a real renderer and takes its picture, so the set
// can be looked at rather than only measured. A number says a shape sits on its
// keyline. It does not say the arc went the wrong way round.
//
//   npx electron scripts/icon-shot.mjs <set> <from> <count>

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const [, , set = '0', from = '0', count = '32'] = process.argv

// Never top level await on whenReady in an ESM main. The ready event lands while
// the module is still being evaluated and the two wait on each other forever.
app.whenReady().then(async () => {
  // On top and in front, because a window standing behind another one is not
  // repainted and the capture comes back as an empty rectangle.
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, x: 0, y: 0 })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.focus()
  // What to show rides in on the address, and the page reads it before it has
  // drawn once. Nothing is changed after the fact and nothing waits on an
  // animation frame: a window that is not in front gets neither.
  await window.loadFile(path.join(root, 'icon-sheet.html'), {
    hash: `keys&only=${set},${from},${count}`
  })
  await new Promise(done => setTimeout(done, 700))
  const shot = await window.webContents.capturePage()
  const out = path.join(root, `icon-sheet-${set}-${from}.png`)
  await writeFile(out, shot.toPNG())
  console.log(out)
  app.quit()
})
