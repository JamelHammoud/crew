import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import electron from 'electron'

// Every cover on one page. A generator like this cannot be judged from its
// numbers: the only question it answers is what the pictures look like side by
// side, and whether any two of them are the same picture. It runs the real
// shader in a real browser, which is also the only place it runs at all.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'cover-sheet.png')

// Written into the temp folder and pointed at the repo by absolute path, so a
// run of this leaves nothing behind in a tree that commits itself.
const entry = (where) => `
import { musicItems } from '${where}/src/shared/music'
import { coverFor } from '${where}/src/renderer/src/components/art/coverArt'
import { coverArt } from '${where}/src/renderer/src/components/art/coverSeed'
window.CrewCovers = { musicItems, coverFor, coverArt }
`

const PAGE = `<!doctype html><html><body style="margin:0"><script src="covers.js"></script><script>
const { ipcRenderer } = require('electron')

window.sheet = () => {
  const { musicItems, coverFor, coverArt } = window.CrewCovers
  const uploads = [0, 1, 2, 3, 4, 5].map(i => ({
    id: 'shelf-' + i + '-track', name: 'Yours ' + i, file: i + '.mp3', seconds: 180, by: 'someone', ts: 1
  }))
  const items = musicItems(uploads)
  const TILE = 240
  const GAP = 16
  const LABEL = 30
  const COLS = 6
  const rows = Math.ceil(items.length / COLS)
  const canvas = document.createElement('canvas')
  canvas.width = COLS * (TILE + GAP) + GAP
  canvas.height = rows * (TILE + LABEL + GAP) + GAP
  const paint = canvas.getContext('2d')
  paint.fillStyle = '#161616'
  paint.fillRect(0, 0, canvas.width, canvas.height)
  const said = []
  items.forEach((item, i) => {
    const x = GAP + (i % COLS) * (TILE + GAP)
    const y = GAP + Math.floor(i / COLS) * (TILE + LABEL + GAP)
    const art = coverFor(item)
    if (art) {
      paint.save()
      paint.beginPath()
      paint.roundRect(x, y, TILE, TILE, 14)
      paint.clip()
      paint.drawImage(art, x, y, TILE, TILE)
      paint.restore()
    } else {
      paint.fillStyle = '#333'
      paint.fillRect(x, y, TILE, TILE)
    }
    const seed = coverArt(item)
    paint.fillStyle = '#dedede'
    paint.font = '13px -apple-system, system-ui, sans-serif'
    paint.fillText(item.name + '  ·  ' + seed.cast + '  ·  ' + seed.petals.length, x, y + TILE + 19)
    said.push({ name: item.name, cast: seed.cast, petals: seed.petals.length })
  })
  return { png: canvas.toDataURL('image/png'), said }
}
</script></body></html>`

const MAIN = `import { app, BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, width: 1600, height: 1200, webPreferences: { nodeIntegration: true, contextIsolation: false, offscreen: false } })
  await window.loadFile(path.join(import.meta.dirname, 'covers.html'))
  const sheet = await window.webContents.executeJavaScript('window.sheet()')
  writeFileSync(process.env.COVER_OUT, Buffer.from(sheet.png.split(',')[1], 'base64'))
  console.log('SHEET ' + JSON.stringify(sheet.said))
  app.exit(0)
}).catch(error => {
  console.log('SHEET_FAILED ' + String(error && error.stack || error))
  app.exit(1)
})
`

const dir = await mkdtemp(path.join(tmpdir(), 'crew-covers-'))
try {
  await writeFile(path.join(dir, 'entry.ts'), entry(root))
  await build({
    entryPoints: [path.join(dir, 'entry.ts')],
    bundle: true,
    format: 'iife',
    outfile: path.join(dir, 'covers.js'),
    logLevel: 'error'
  })
  await writeFile(path.join(dir, 'covers.html'), PAGE)
  await writeFile(path.join(dir, 'main.mjs'), MAIN)

  const said = await new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.mjs')], {
      env: { ...process.env, COVER_OUT: out, ELECTRON_ENABLE_LOGGING: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let text = ''
    child.stdout.on('data', chunk => (text += chunk))
    child.stderr.on('data', chunk => (text += chunk))
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('the sheet never finished'))
    }, 120_000)
    child.on('exit', () => {
      clearTimeout(timer)
      const failed = text.split('\n').find(line => line.startsWith('SHEET_FAILED '))
      if (failed) return reject(new Error(failed.slice(13)))
      const line = text.split('\n').find(one => one.startsWith('SHEET '))
      if (!line) return reject(new Error('the sheet said nothing:\n' + text))
      resolve(JSON.parse(line.slice(6)))
    })
  })

  const casts = {}
  for (const one of said) casts[one.cast] = (casts[one.cast] || 0) + 1
  console.log(`${said.length} covers drawn to ${path.relative(root, out)}`)
  console.log(
    Object.entries(casts)
      .map(([cast, count]) => `${cast} ${count}`)
      .join(', ')
  )
} finally {
  await rm(dir, { recursive: true, force: true })
}
