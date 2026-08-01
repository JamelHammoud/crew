const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 480, height: 900, show: false, backgroundColor: '#000000' })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  await wait(1200)
  // open two files so the reading is on screen, and mark one row read
  await win.webContents.executeJavaScript(`
    const rows = [...document.querySelectorAll('[aria-expanded]')]
    rows[0]?.click()
    const marks = [...document.querySelectorAll('[aria-label="Mark as read"]')]
    marks[2]?.click()
    marks[5]?.click()
  `)
  await wait(900)
  const shot = await win.webContents.capturePage()
  fs.writeFileSync(process.env.SHOT_OUT, shot.toPNG())
  console.log('SHOT ' + JSON.stringify({ ok: true }))
  app.quit()
}).catch(e => { console.log('SHOT ' + JSON.stringify({ failed: String(e) })); app.quit() })
