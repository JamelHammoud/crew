
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1180, height: 1080, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false } })
  await win.loadFile("/Users/jamel/Documents/Repositories/crew/hangup-probe.html")
  await new Promise(r => setTimeout(r, 900))
  const img = await win.webContents.capturePage()
  fs.writeFileSync("/Users/jamel/Documents/Repositories/crew/hangup-probe.png", img.toPNG())
  app.quit()
})
