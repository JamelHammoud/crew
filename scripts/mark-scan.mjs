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
    const bmp = image.getBitmap()
    const scale = size.width / 200
    const stride = size.width
    console.log('capture', size.width + 'x' + size.height, 'scale', scale, 'stride', stride)
    const at = (x, y) => {
      const i = (y * stride + x) * 4
      return [bmp[i + 2], bmp[i + 1], bmp[i]]
    }
    const LIT = 24
    for (const row of rows) {
      const y0 = Math.round(row.top * scale)
      const y1 = Math.round((row.top + row.height) * scale)
      const x0 = Math.round(row.left * scale)
      const x1 = Math.round((row.left + row.width) * scale)
      const thin = []
      for (let y = y0; y < y1; y++) {
        const lum = []
        for (let x = x0; x < x1; x++) {
          const [r, g, b] = at(x, y)
          lum.push(0.2126 * r + 0.7152 * g + 0.0722 * b)
        }
        let run = 0
        for (let i = 0; i <= lum.length; i++) {
          const lit = i < lum.length && lum[i] > LIT
          if (lit) { run++; continue }
          if (run > 0 && run <= 2) {
            const peak = Math.max(...lum.slice(i - run, i))
            if (peak > 40) thin.push({ y: y - y0, x: i - run, run, peak: Math.round(peak) })
          }
          run = 0
        }
      }
      const worst = thin.sort((a, b) => b.peak - a.peak).slice(0, 4)
      console.log(
        String(row.at).padStart(4) + 'ms  hairlines: ' + thin.length +
        (worst.length ? '  worst ' + worst.map(t => 'x' + t.x + ' y' + t.y + ' w' + t.run + ' lum' + t.peak).join(', ') : '')
      )
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
