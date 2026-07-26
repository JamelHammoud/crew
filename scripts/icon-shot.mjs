import { app, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Puts the sheet in front of a real renderer and takes its picture, so the set
// can be looked at rather than only measured. A number says a shape sits on its
// keyline. It does not say the arc went the wrong way round.
//
//   npx electron scripts/icon-shot.mjs <pixels to scroll past>
//
// What to show is written into a copy of the page before it is opened, never
// switched on afterwards. A window that is not the front one is painted once and
// never again, so anything changed after that first paint is captured blank.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const [, , offset = '0'] = process.argv

// The page is pulled up rather than cut down. Hiding most of the cards leaves a
// page shorter than the window, and a short page in a window that is not in
// front captures as an empty rectangle. Sliding a tall page under the viewport
// keeps everything the compositor needs and still moves the view.
const shift = `<style>body { margin-top: -${offset}px }</style>`

app.whenReady().then(async () => {
  const page = await readFile(path.join(root, 'icon-sheet.html'), 'utf8')
  const cut = path.join(root, 'icon-slice.html')
  await writeFile(cut, page.replace('<h1', `${shift}<h1`))

  const window = new BrowserWindow({ width: 1440, height: 900, show: true, x: 0, y: 0 })
  window.setAlwaysOnTop(true, 'screen-saver')
  // The whole app has to come forward, not just the window. macOS hands back an
  // empty rectangle for a window belonging to an app that is not the active one.
  app.focus({ steal: true })
  window.focus()
  await window.loadFile(cut)
  // Asking the page a question is what gets it drawn at all.
  await window.webContents.executeJavaScript('document.body.classList.add("keys"), document.title')
  await new Promise(done => setTimeout(done, 1500))
  const shot = await window.webContents.capturePage()
  const out = path.join(root, `icon-sheet-${offset}.png`)
  await writeFile(out, shot.toPNG())
  console.log(`${out}  ${shot.getSize().width}x${shot.getSize().height}`)
  app.quit()
})
