import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const HASH = ['M3.4 7.3H16.6', 'M16.6 12.7H3.4', 'M7.3 3.4V16.6', 'M12.7 16.6V3.4']

const CASES = [
  ['siblings', HASH.map(d => `<path d="${d}"/>`).join('')],
  ['one-path', `<path d="${HASH.join('')}"/>`],
  [
    'mask',
    `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
       <g stroke="#fff" fill="none" stroke-width="1.67" stroke-linecap="round">${HASH.map(d => `<path d="${d}"/>`).join('')}</g>
     </mask>
     <rect width="20" height="20" fill="currentColor" mask="url(#m)" stroke="none"/>`
  ]
]

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#0a0a0b; }
  .row { display:flex; }
  svg { width:400px; height:400px; }
</style></head><body><div class="row">
${CASES.map(
  ([say, art]) => `<div data-say="${say}" style="color:rgba(255,255,255,0.45)">
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">${art}</svg>
</div>`
).join('\n')}
</div></body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1240, height: 460, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'page.html'))
    await wait(500)
    const page = await win.webContents.executeJavaScript(\`JSON.stringify({
      width: innerWidth,
      boxes: [...document.querySelectorAll('[data-say]')].map(el => {
        const r = el.querySelector('svg').getBoundingClientRect()
        return { say: el.dataset.say, x: r.x, y: r.y, w: r.width }
      })
    })\`)
    const shot = await win.webContents.capturePage()
    const bits = shot.toBitmap()
    const size = shot.getSize()
    const { width, boxes } = JSON.parse(page)
    const scale = size.width / width
    // The svg is 400 css px across a 20 unit viewBox, so one unit is 20 css px.
    const read = (box, ux, uy) => {
      const x = Math.round((box.x + ux * 20) * scale)
      const y = Math.round((box.y + uy * 20) * scale)
      const at = (y * size.width + x) * 4
      return bits[at + 2]
    }
    console.log('SEEN ' + JSON.stringify(boxes.map(box => ({
      say: box.say,
      crossing: read(box, 7.3, 7.3),
      alsoCrossing: read(box, 12.7, 12.7),
      plainRule: read(box, 10, 7.3),
      plainPost: read(box, 7.3, 10),
      ground: read(box, 2, 2)
    }))))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-mark-')))
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
for (const one of seen) {
  const lift = one.crossing - one.plainRule
  console.log(
    `${one.say.padEnd(10)} crossing ${String(one.crossing).padStart(3)} / ${String(one.alsoCrossing).padStart(3)}   plain ${String(one.plainRule).padStart(3)} / ${String(one.plainPost).padStart(3)}   ground ${one.ground}   crossing is ${lift > 0 ? '+' : ''}${lift} over the plain run`
  )
}
