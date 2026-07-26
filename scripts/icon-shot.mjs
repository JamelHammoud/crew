import { app, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Puts the sheet in front of a real renderer and takes its picture, so the set
// can be looked at rather than only measured. A number says a shape sits on its
// keyline. It does not say the arc went the wrong way round.
//
//   npx electron scripts/icon-shot.mjs <set> <from> <count>
//
// What to show is written into a copy of the page before it is opened, never
// switched on afterwards. A window that is not the front one is painted once and
// never again, so anything changed after that first paint is captured blank.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const [, , set = '0', from = '0', count = '32'] = process.argv
const first = Number(from)
const last = first + Number(count)

const slice = `<style>
section:not(:nth-of-type(${Number(set) + 1})), .bar, p.lede { display:none }
.grid figure:nth-child(-n+${first}), .grid figure:nth-child(n+${last + 1}) { display:none }
</style>`

app.whenReady().then(async () => {
  const page = await readFile(path.join(root, 'icon-sheet.html'), 'utf8')
  const cut = path.join(root, 'icon-slice.html')
  await writeFile(cut, page.replace('<body', `${slice}<body`).replace('<h1', `${slice}<h1`))

  const window = new BrowserWindow({ width: 1440, height: 900, show: true, x: 0, y: 0 })
  window.setAlwaysOnTop(true, 'screen-saver')
  await window.loadFile(cut)
  // Asking the page a question is what gets it drawn at all.
  await window.webContents.executeJavaScript('document.body.classList.add("keys"), document.title')
  await new Promise(done => setTimeout(done, 1500))
  const shot = await window.webContents.capturePage()
  const out = path.join(root, `icon-sheet-${set}-${from}.png`)
  await writeFile(out, shot.toPNG())
  console.log(`${out}  ${shot.getSize().width}x${shot.getSize().height}`)
  app.quit()
})
