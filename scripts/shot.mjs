import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import electron from 'electron'

const file = path.resolve(process.argv[2])
const out = path.resolve(process.argv[3])
const w = Number(process.argv[4] ?? 1100)
const h = Number(process.argv[5] ?? 1000)

const main = `
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${w}, height: ${h}, show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false } })
  await win.loadFile(${JSON.stringify(file)})
  await new Promise(r => setTimeout(r, 900))
  const img = await win.webContents.capturePage()
  fs.writeFileSync(${JSON.stringify(out)}, img.toPNG())
  app.quit()
})
`
const tmp = path.join(path.dirname(out), '.shot-main.cjs')
await writeFile(tmp, main)
const run = spawn(electron, [tmp], { stdio: 'inherit' })
run.on('exit', code => process.exit(code ?? 0))
