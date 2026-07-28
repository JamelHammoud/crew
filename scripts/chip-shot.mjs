import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const page = path.join(root, 'chip-probe.html')
const shot = path.join(root, 'chip-probe.png')
const main = path.join(root, 'chip-shot-main.cjs')

fs.writeFileSync(
  main,
  `const { app, BrowserWindow } = require('electron')
const fs = require('fs')
app.commandLine.appendSwitch('force-device-scale-factor', '2')
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 820, height: 900, show: false, backgroundColor: '#141414' })
  await win.loadFile(${JSON.stringify(page)})
  const size = await win.webContents.executeJavaScript('document.body.scrollHeight')
  win.setContentSize(820, Math.min(size, 2000))
  await new Promise(r => setTimeout(r, 400))
  const image = await win.webContents.capturePage()
  fs.writeFileSync(${JSON.stringify(shot)}, image.toPNG())
  app.exit(0)
})
setTimeout(() => app.exit(1), 20000)
`
)

const child = spawn(electron, [main], { stdio: 'inherit' })
child.on('exit', code => {
  fs.rmSync(main, { force: true })
  process.exit(code ?? 1)
})
