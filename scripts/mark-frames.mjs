import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

// The mark's arrival, stopped every so many milliseconds and laid out one row
// per moment. A hairline that only shows on some frames cannot be found by
// watching it, and it cannot be found in the numbers either, because what is
// wrong is where two circles land against each other.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'mark-frames.png')
const tall = Number(process.argv[3] ?? 120)
const times = process.argv[4]
  ? process.argv[4].split(',').map(Number)
  : [0, 40, 90, 140, 180, 220, 260, 300, 360, 420, 480, 560, 640, 720, 820, 940]

const entry = (where) => `
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { CrewMark } from '${where}/src/renderer/src/components/CrewMark'
window.CrewMarkParts = { createElement, createRoot, CrewMark }
`

const PAGE = (rules, height) => `<!doctype html><html><head><style>
body { margin: 0; background: #141414; font-family: system-ui; color: #707070; }
.strip { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px; }
.cell { position: relative; }
.cell span { position: absolute; left: 2px; top: 2px; font-size: 10px; }
.crew-logo { display: flex; align-items: center; color: #fff; padding: 14px; }
svg { display: block; }
${rules}
</style></head><body><div class="strip" id="strip"></div><script src="mark.js"></script><script>
const { ipcRenderer } = require('electron')
const { createElement, createRoot, CrewMark } = window.CrewMarkParts
const AT = [0, 40, 90, 140, 180, 220, 260, 300, 360, 420, 480, 560, 640, 720, 820, 940]
const strip = document.getElementById('strip')

for (const ms of AT) {
  const cell = document.createElement('div')
  cell.className = 'cell'
  const holder = document.createElement('div')
  holder.className = 'crew-logo'
  holder.dataset.lit = 'true'
  const label = document.createElement('span')
  label.textContent = ms + 'ms'
  cell.appendChild(holder)
  cell.appendChild(label)
  strip.appendChild(cell)
  createRoot(holder).render(createElement(CrewMark, { live: true, height: ${height} }))
  holder.dataset.at = String(ms)
}

setTimeout(() => {
  for (const cell of document.querySelectorAll('.crew-logo')) {
    const ms = Number(cell.dataset.at)
    for (const animation of cell.getAnimations({ subtree: true })) {
      animation.pause()
      animation.currentTime = ms
    }
  }
  setTimeout(() => ipcRenderer.send('shot'), 400)
}, 600)
</script></body></html>`

const css = await readFile(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const from = css.indexOf('/* None of the mark')
const to = css.indexOf('/* Every design surface')
const rules = css.slice(from, to)

const dir = await mkdtemp(path.join(tmpdir(), 'crew-mark-'))
await writeFile(path.join(dir, 'entry.jsx'), entry(root))
await build({
  entryPoints: [path.join(dir, 'entry.jsx')],
  bundle: true,
  outfile: path.join(dir, 'mark.js'),
  format: 'iife',
  jsx: 'automatic',
  absWorkingDir: root,
  nodePaths: [path.join(root, 'node_modules')]
})
await writeFile(path.join(dir, 'index.html'), PAGE(rules, tall))

const main = `
const { app, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
app.commandLine.appendSwitch('force-device-scale-factor', '2')
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    backgroundColor: '#141414',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  ipcMain.on('shot', async () => {
    const image = await win.webContents.capturePage()
    fs.writeFileSync(${JSON.stringify(out)}, image.toPNG())
    app.exit(0)
  })
  win.loadFile(${JSON.stringify(path.join(dir, 'index.html'))})
  setTimeout(() => app.exit(1), 25000)
})
`
await writeFile(path.join(dir, 'main.cjs'), main)

const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: 'inherit' })
child.on('exit', async (code) => {
  await rm(dir, { recursive: true, force: true })
  console.log(code === 0 ? 'wrote ' + out : 'failed')
  process.exit(code ?? 1)
})
