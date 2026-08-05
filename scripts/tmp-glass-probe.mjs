import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const root = '/Users/jamel/Documents/Repositories/crew'

const PAGE = `<!doctype html>
<html class="mac"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans">
  <div id="root">
    <div class="flex h-screen">
      <!-- the pinned rail: its own backdrop-filter, with a hard edge inside it -->
      <aside id="rail" class="sidebar-pinned bg-ink-800" style="width:420px">
        <div id="scroller" class="scroll-fade" data-fade-top data-fade-bottom style="height:100%;overflow-y:auto;background:linear-gradient(to right,#000 0 200px,#fff 200px 100%)"></div>
      </aside>
      <!-- a plain column, same hard edge, no backdrop-filter of its own -->
      <div style="flex:1;background:linear-gradient(to right,#000 0 200px,#fff 200px 100%)"></div>
    </div>
  </div>
  <div id="overRail" class="glass fixed rounded-2xl" style="left:100px;top:60px;width:200px;height:120px"></div>
  <div id="overPlain" class="glass fixed rounded-2xl" style="left:520px;top:60px;width:200px;height:120px"></div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 900, height: 400, show: true, frame: false, transparent: true, backgroundColor: '#00000000', vibrancy: 'under-window' })
  const read = async () => {
    const shot = await win.webContents.capturePage()
    const bmp = shot.toBitmap(); const size = shot.getSize()
    const scale = size.width / 900
    const row = (x0, x1, y) => {
      const yy = Math.round(y * scale); const out = []
      for (let x = x0; x < x1; x += 5) out.push(bmp[(yy * size.width + Math.round(x * scale)) * 4])
      return out
    }
    return { overRail: row(105, 295, 120), overPlain: row(525, 715, 120) }
  }
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(800)
    const normal = await read()
    await win.webContents.executeJavaScript("document.getElementById('root').classList.add('railed')")
    await wait(400)
    const railed = await read()
    await win.webContents.executeJavaScript("for (const id of ['overRail','overPlain']) document.getElementById(id).style.backdropFilter = 'none'")
    await wait(500)
    const cardsUnblurred = await read()
    const where = await win.webContents.executeJavaScript("JSON.stringify(['overRail','overPlain'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left, r.top, r.width, r.height] }))")
    console.log('SEEN ' + JSON.stringify({ normal, cardsUnblurred, where: JSON.parse(where) }))
  } catch (e) { console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) })) }
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

const seen = await new Promise((res, rej) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', c => (out += c)); child.stderr.on('data', () => {})
  child.on('exit', () => { const l = out.split('\n').find(r => r.startsWith('SEEN ')); l ? res(JSON.parse(l.slice(5))) : rej(new Error('nothing back')) })
  child.on('error', rej)
})
if (seen.failed) throw new Error(seen.failed)
const ramp = v => { const lo = Math.min(...v), hi = Math.max(...v); return v.filter(n => n > lo + (hi-lo)*0.15 && n < hi - (hi-lo)*0.15).length }
for (const [name, o] of Object.entries(seen)) {
  console.log(name.padEnd(14), 'overRail ramp=' + String(ramp(o.overRail)).padStart(2), ' overPlain ramp=' + String(ramp(o.overPlain)).padStart(2))
  console.log('   rail :', o.overRail.join(','))
  console.log('   plain:', o.overPlain.join(','))
}
await rm(dir, { recursive: true, force: true })
