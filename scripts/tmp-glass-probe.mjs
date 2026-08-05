import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = '/Users/jamel/Documents/Repositories/crew'

// A hard black/white edge under a glass card. Blurred, the edge smears across
// the card. Unblurred, it stays a step.
const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans">
  <div id="root">
    <div style="position:fixed;inset:0;background:linear-gradient(to right,#000 0 300px,#fff 300px 100%)"></div>
  </div>
  <div id="card" class="glass fixed rounded-2xl" style="left:200px;top:100px;width:200px;height:120px"></div>
  <div id="strong" class="glass glass-strong fixed rounded-2xl" style="left:200px;top:260px;width:200px;height:120px"></div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 600, height: 500, show: true })
  const read = async label => {
    const shot = await win.webContents.capturePage()
    const bmp = shot.toBitmap(); const size = shot.getSize()
    const scale = size.width / 600
    // walk a row through the middle of each card, left to right
    const row = y => {
      const yy = Math.round(y * scale)
      const out = []
      for (let x = 205; x < 395; x += 5) {
        const at = (yy * size.width + Math.round(x * scale)) * 4
        out.push(bmp[at])
      }
      return out
    }
    return { label, card: row(160), strong: row(320) }
  }
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(700)
    const withFilter = await read('body filter: blur(0)')
    await win.webContents.executeJavaScript("document.body.style.filter = 'none'")
    await wait(500)
    const without = await read('body filter: none')
    console.log('SEEN ' + JSON.stringify({ withFilter, without }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-glass-')))
await writeFile(path.join(dir, 'index.html'), PAGE)
await writeFile(path.join(dir, 'probe.css'), `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`)
await writeFile(path.join(dir, 'probe.js'), `import './probe.css'\n`)
await writeFile(path.join(dir, 'main.cjs'), MAIN)

const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({ root: dir, base: './', logLevel: 'silent', plugins: [tailwind()], build: { outDir: path.join(dir, 'dist'), emptyOutDir: true } })
const assets = path.join(dir, 'dist/assets')
const sheet = (await readdir(assets)).find(n => n.endsWith('.css'))
const css = await readFile(path.join(assets, sheet), 'utf8')
console.log('backdrop-filter in sheet:', css.includes('backdrop-filter'))

const seen = await new Promise((res, rej) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', c => (out += c))
  child.stderr.on('data', () => {})
  child.on('exit', () => {
    const line = out.split('\n').find(r => r.startsWith('SEEN '))
    line ? res(JSON.parse(line.slice(5))) : rej(new Error('nothing back'))
  })
  child.on('error', rej)
})

const show = (o) => {
  for (const key of ['card','strong']) {
    const v = o[key]
    // how many samples sit strictly between the two plateaus = how wide the edge is
    const lo = Math.min(...v), hi = Math.max(...v)
    const mid = v.filter(n => n > lo + (hi-lo)*0.15 && n < hi - (hi-lo)*0.15).length
    console.log(`  ${key.padEnd(7)} lo=${lo} hi=${hi} samples-in-ramp=${mid}  ${v.join(',')}`)
  }
}
console.log('=== ' + seen.withFilter.label); show(seen.withFilter)
console.log('=== ' + seen.without.label); show(seen.without)

await rm(dir, { recursive: true, force: true })
