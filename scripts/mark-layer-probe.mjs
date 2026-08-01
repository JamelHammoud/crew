import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const CHAT = {
  strokes: [
    'M6.2 3.5H13.8A3.2 3.2 0 0 1 17 6.7V10.1A3.2 3.2 0 0 1 13.8 13.3H8.9L6.05 16.05Q5.25 16.75 5.25 15.7V13.05A3.2 3.2 0 0 1 3 10.1V6.7A3.2 3.2 0 0 1 6.2 3.5Z'
  ],
  fills: [7.1, 10, 12.9].map(cx => `<circle cx="${cx}" cy="8.4" r="0.9"/>`)
}

const DOCS = {
  strokes: [
    'M11.2 2.6H6.2A1.8 1.8 0 0 0 4.4 4.4V15.6A1.8 1.8 0 0 0 6.2 17.4H13.8A1.8 1.8 0 0 0 15.6 15.6V7Z',
    'M11.2 2.6V6A1 1 0 0 0 12.2 7H15.6',
    'M7.2 11H12.8',
    'M7.2 13.5H10.4'
  ],
  fills: []
}

const DESIGN = {
  strokes: ['M3.4 7.3H16.6', 'M16.6 12.7H3.4', 'M7.3 3.4V16.6', 'M12.7 16.6V3.4'],
  fills: []
}

const MARKS = { chat: CHAT, docs: DOCS, design: DESIGN }

const asIs = mark =>
  mark.strokes.map(d => `<path d="${d}"/>`).join('') +
  mark.fills.map(one => one.replace('/>', ' fill="currentColor" stroke="none"/>')).join('')

const masked = (mark, id) =>
  `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
     <g stroke="#fff" fill="none" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round">
       ${mark.strokes.map(d => `<path d="${d}"/>`).join('')}
       ${mark.fills.map(one => one.replace('/>', ' fill="#fff" stroke="none"/>')).join('')}
     </g>
   </mask>
   <rect width="20" height="20" fill="currentColor" stroke="none" mask="url(#${id})"/>`

const CASES = []
for (const [name, mark] of Object.entries(MARKS)) {
  CASES.push([`${name} as-is`, asIs(mark)])
  CASES.push([`${name} masked`, masked(mark, `m-${name}`)])
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#0a0a0b; }
  .row { display:flex; flex-wrap:wrap; }
  svg { width:300px; height:300px; }
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
  const win = new BrowserWindow({ width: 960, height: 700, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'page.html'))
    await wait(500)
    const page = await win.webContents.executeJavaScript(\`JSON.stringify({
      width: innerWidth,
      boxes: [...document.querySelectorAll('[data-say]')].map(el => {
        const r = el.querySelector('svg').getBoundingClientRect()
        return { say: el.dataset.say, x: r.x, y: r.y, w: r.width, h: r.height }
      })
    })\`)
    const shot = await win.webContents.capturePage()
    const bits = shot.toBitmap()
    const size = shot.getSize()
    const { width, boxes } = JSON.parse(page)
    const scale = size.width / width

    console.log('SEEN ' + JSON.stringify(boxes.map(box => {
      const x0 = Math.round(box.x * scale), y0 = Math.round(box.y * scale)
      const x1 = Math.round((box.x + box.w) * scale), y1 = Math.round((box.y + box.h) * scale)
      const hist = new Map()
      let top = 0, painted = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = bits[(y * size.width + x) * 4 + 2]
          if (v < 40) continue
          painted++
          if (v > top) top = v
          hist.set(v, (hist.get(v) || 0) + 1)
        }
      }
      // The level the mark is really drawn at is the one the most pixels sit on.
      let plain = 0, most = 0
      for (const [v, n] of hist) if (n > most) { most = n; plain = v }
      let over = 0
      for (const [v, n] of hist) if (v > plain + 12) over += n
      return { say: box.say, plain, top, painted, over }
    })))
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
  const share = one.painted ? Math.round((one.over / one.painted) * 1000) / 10 : 0
  console.log(
    `${one.say.padEnd(14)} drawn at ${String(one.plain).padStart(3)}   brightest ${String(one.top).padStart(3)}   layered ${String(one.over).padStart(5)} px of ${String(one.painted).padStart(5)} (${share}%)`
  )
}
