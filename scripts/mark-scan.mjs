import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

// The mark at the size it is really drawn, read pixel by pixel along its own
// middle. A hairline a fraction of a pixel wide is a number here and nothing at
// all on a screen shot.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const times = (process.argv[2] ?? '460,477,500,700,720,940').split(',').map(Number)
const parts = process.argv[3] ?? 'all'

const entry = (where) => `
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { CrewMark } from '${where}/src/renderer/src/components/CrewMark'
window.CrewMarkParts = { createElement, createRoot, CrewMark }
`

const PAGE = (rules, at, keep) => `<!doctype html><html><head><style>
body { margin: 0; background: #000000; }
.crew-logo { position: absolute; left: 0; color: #fff; }
svg { display: block; }
${rules}
</style></head><body><script src="mark.js"></script><script>
const { ipcRenderer } = require('electron')
const { createElement, createRoot, CrewMark } = window.CrewMarkParts
const AT = ${JSON.stringify(at)}
const KEEP = ${JSON.stringify(keep)}

AT.forEach((ms, row) => {
  const holder = document.createElement('div')
  holder.className = 'crew-logo'
  holder.dataset.lit = 'true'
  holder.style.top = row * 30 + 'px'
  document.body.appendChild(holder)
  createRoot(holder).render(createElement(CrewMark, { live: true, height: 18 }))
  holder.dataset.at = String(ms)
})

setTimeout(() => {
  for (const cell of document.querySelectorAll('.crew-logo')) {
    if (KEEP !== 'all') {
      for (const sel of ['.crew-flash', '.crew-sweep']) for (const el of cell.querySelectorAll(sel)) el.remove()
    }
    if (KEEP === 'discs') for (const el of cell.querySelectorAll('.crew-mesh')) el.remove()
    const ms = Number(cell.dataset.at)
    for (const animation of cell.getAnimations({ subtree: true })) {
      animation.pause()
      animation.currentTime = ms
    }
  }
  setTimeout(() => {
    const rows = [...document.querySelectorAll('.crew-logo')].map(cell => {
      const svg = cell.querySelector('svg').getBoundingClientRect()
      return { at: Number(cell.dataset.at), top: svg.top, height: svg.height, left: svg.left, width: svg.width }
    })
    ipcRenderer.send('scan', rows)
  }, 300)
}, 600)
</script></body></html>`

const css = await readFile(path.join(root, 'src/renderer/src/styles.css'), 'utf8')
const rules = css.slice(css.indexOf('/* None of the mark'), css.indexOf('/* Every design surface'))

const dir = await mkdtemp(path.join(tmpdir(), 'crew-scan-'))
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
await writeFile(path.join(dir, 'index.html'), PAGE(rules, times, parts))

const main = `
const { app, BrowserWindow, ipcMain } = require('electron')
app.commandLine.appendSwitch('force-device-scale-factor', '2')
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 200, height: ${times.length * 30 + 20}, show: false,
    backgroundColor: '#000000',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  ipcMain.on('scan', async (_e, rows) => {
    const image = await win.webContents.capturePage()
    const size = image.getSize()
    const scale = image.getScaleFactor ? 2 : 2
    const bmp = image.getBitmap()
    const at = (x, y) => {
      const i = (y * size.width * scale + x) * 4
      return [bmp[i + 2], bmp[i + 1], bmp[i]]
    }
    for (const row of rows) {
      const y = Math.round((row.top + row.height / 2) * scale)
      const x0 = Math.round(row.left * scale)
      const x1 = Math.round((row.left + row.width) * scale)
      const line = []
      for (let x = x0; x < x1; x++) line.push(at(x, y))
      const lum = line.map(([r, g, b]) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b))
      console.log(String(row.at).padStart(4) + 'ms ' + lum.map(v => String(v).padStart(3)).join(' '))
    }
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
  process.exit(code ?? 1)
})
