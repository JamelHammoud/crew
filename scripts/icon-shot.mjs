import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Puts the sheet in front of a real renderer and takes its picture, so the set
// can be looked at rather than only measured. A number says a shape sits on its
// keyline. It does not say the arc went the wrong way round.
//
//   npx electron scripts/icon-shot.mjs <scrollTop>

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const [, , top = '0'] = process.argv

// Never top level await on whenReady in an ESM main. The ready event lands while
// the module is still being evaluated and the two wait on each other forever.
app.whenReady().then(async () => {
  // On top and in front, because a window standing behind another one is not
  // repainted and the capture comes back as an empty rectangle.
  const window = new BrowserWindow({ width: 1440, height: 900, show: true, x: 0, y: 0 })
  window.setAlwaysOnTop(true, 'screen-saver')
  window.focus()
  await window.loadFile(path.join(root, 'icon-sheet.html'))
  // Nothing here waits on an animation frame either. A window standing behind
  // another one is throttled to almost no frames, and the wait never ends. It
  // scrolls rather than taking cards out, because a page that has just had most
  // of itself removed captures blank.
  await window.webContents.executeJavaScript(`
    document.body.classList.add('keys')
    window.scrollTo(0, ${top})
    document.title
  `)
  await new Promise(done => setTimeout(done, 700))
  const shot = await window.webContents.capturePage()
  const out = path.join(root, `icon-sheet-${top}.png`)
  await writeFile(out, shot.toPNG())
  console.log(out)
  app.quit()
})
