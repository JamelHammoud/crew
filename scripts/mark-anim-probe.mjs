import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const HASH = ['M3.4 7.3H16.6', 'M16.6 12.7H3.4', 'M7.3 3.4V16.6', 'M12.7 16.6V3.4']
const DELAY = [0, 90, 200, 290]

const inside = HASH.map(
  (d, i) =>
    `<path class="draw" pathLength="1" d="${d}" style="--draw-dur:200ms;--draw-delay:${DELAY[i]}ms"/>`
).join('')

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#0a0a0b; }
  svg { width:300px; height:300px; }
  .draw { stroke-dasharray: 1 1.2; animation: draw var(--draw-dur) linear var(--draw-delay) both; }
  @keyframes draw { from { stroke-dashoffset: 1.1 } to { stroke-dashoffset: 0 } }
</style></head><body>
<div style="color:rgba(255,255,255,0.45)">
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round">
    <mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
      <g stroke="#fff" fill="none" stroke-width="1.67" stroke-linecap="round">${inside}</g>
    </mask>
    <rect width="20" height="20" fill="currentColor" stroke="none" mask="url(#m)"/>
  </svg>
</div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 400, height: 400, show: true })
  const painted = async at => {
    await win.webContents.executeJavaScript(
      'document.getAnimations().forEach(a => { a.pause(); a.currentTime = ' + at + ' }); 1'
    )
    await wait(220)
    const shot = await win.webContents.capturePage()
    const bits = shot.toBitmap()
    const size = shot.getSize()
    let on = 0, top = 0
    for (let i = 0; i < bits.length; i += 4) {
      const v = bits[i + 2]
      if (v > 40) { on++; if (v > top) top = v }
    }
    return { on, top }
  }
  try {
    await win.loadFile(path.join(__dirname, 'page.html'))
    await wait(500)
    console.log('SEEN ' + JSON.stringify({
      early: await painted(60),
      middle: await painted(260),
      done: await painted(5000)
    }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-anim-')))
await writeFile(path.join(dir, 'page.html'), PAGE)
await writeFile(path.join(dir, 'main.cjs'), MAIN)

const seen = await new Promise((resolve, reject) => {
  const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  child.stdout.on('data', chunk => (out += chunk))
  child.stderr.on('data', () => {})
  child.on('exit', () => {
    const line = out.split('\n').find(row => row.startsWith('SEEN '))
    if (!line) return reject(new Error('the window said nothing back'))
    resolve(JSON.parse(line.slice(5)))
  })
  child.on('error', reject)
})
await rm(dir, { recursive: true, force: true })

if (seen.failed) throw new Error(seen.failed)
console.log(`at 60ms   ${String(seen.early.on).padStart(6)} px painted, brightest ${seen.early.top}`)
console.log(`at 260ms  ${String(seen.middle.on).padStart(6)} px painted, brightest ${seen.middle.top}`)
console.log(`at rest   ${String(seen.done.on).padStart(6)} px painted, brightest ${seen.done.top}`)
console.log(
  seen.early.on < seen.middle.on && seen.middle.on < seen.done.on
    ? 'the mark draws itself in through the mask'
    : 'the mask is not animating: it painted the same at every moment'
)
