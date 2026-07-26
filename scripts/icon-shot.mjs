import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Puts the sheet in front of a real renderer and takes its picture, so the set
// can be looked at rather than only measured. A number says a shape sits on its
// keyline. It does not say the arc went the wrong way round.
//
//   npx electron scripts/icon-shot.mjs <section> <from> <count>

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const [, , section = '0', from = '0', count = '36'] = process.argv

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
  // another one is throttled to almost no frames, and the wait never ends.
  await window.webContents.executeJavaScript(`
    document.body.classList.add('keys')
    const keep = document.querySelectorAll('section')[${section}]
    for (const el of document.querySelectorAll('section, .bar, p.lede, h1')) if (el !== keep) el.remove()
    for (const [i, card] of [...keep.querySelectorAll('figure')].entries())
      if (i < ${from} || i >= ${Number(from) + Number(count)}) card.remove()
    document.title
  `)
  await new Promise(done => setTimeout(done, 500))
  const shot = await window.webContents.capturePage()
  const out = path.join(root, `icon-sheet-${section}-${from}.png`)
  await writeFile(out, shot.toPNG())
  console.log(out)
  app.quit()
})
