import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const shot = path.join(root, 'computer-options.png')

const SQ = { x: 3.5, side: 17 }
const box = (x, y, side, r) => {
  const e = x + side
  const b = y + side
  return `M${x + r} ${y}H${e - r}A${r} ${r} 0 0 1 ${e} ${y + r}V${b - r}A${r} ${r} 0 0 1 ${e - r} ${b}H${x + r}A${r} ${r} 0 0 1 ${x} ${b - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
}

const CASE = box(SQ.x, SQ.x, SQ.side, 2.5)
const SOFT = box(SQ.x, SQ.x, SQ.side, 4.25)

const OPTIONS = [
  { say: '1  case', note: 'the square on its own', d: CASE },
  { say: '2  soft case', note: 'the same, softer corners', d: SOFT },
  { say: '3  chip', note: 'a core inside the case', d: `${CASE}${box(8.5, 8.5, 7, 1)}` },
  { say: '4  chip, soft', note: 'the core in the softer case', d: `${SOFT}${box(8.5, 8.5, 7, 1)}` },
  { say: '5  dot', note: 'a light on the case', d: CASE, dot: true },
  { say: '6  bar', note: 'a foot inside the case', d: `${CASE}M9.25 16.25H14.75` },
  { say: '7  screen', note: 'a line across the top', d: `${CASE}M3.5 8.75H20.5` }
]

const FOLDER =
  'M2.75 7.5A2.5 2.5 0 0 1 5.25 5H9.4a2 2 0 0 1 1.6.8l1 1.35a2 2 0 0 0 1.6.8h5.15A2.5 2.5 0 0 1 21.25 10.45V16.5A2.5 2.5 0 0 1 18.75 19H5.25A2.5 2.5 0 0 1 2.75 16.5Z'
const GLOBE =
  'M2.75 12A9.25 9.25 0 0 1 21.25 12A9.25 9.25 0 0 1 2.75 12ZM8 12A4 9.25 0 0 1 16 12A4 9.25 0 0 1 8 12ZM2.75 12H21.25'

const mark = (d, at, dot) =>
  `<svg width="${at}" height="${at}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/>${dot ? '<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>' : ''}</svg>`

const row = one => `
<div class="row">
  <div class="say"><b>${one.say}</b><i>${one.note}</i></div>
  <div class="big keyed">${mark(one.d, 96, one.dot)}</div>
  <div class="worn">
    ${[24, 20, 18, 16].map(at => `<span class="at">${mark(one.d, at, one.dot)}<em>${at}</em></span>`).join('')}
  </div>
  <div class="beside">
    ${mark(FOLDER, 16)}${mark(one.d, 16, one.dot)}${mark(GLOBE, 16)}
  </div>
</div>`

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box }
  body { margin: 0; background: #141414; color: #fff; font: 13px -apple-system, system-ui, sans-serif; padding: 28px 32px }
  h1 { font-size: 13px; font-weight: 500; color: rgba(255,255,255,.45); margin: 0 0 22px }
  .row { display: grid; grid-template-columns: 132px 116px 1fr 112px; align-items: center; gap: 24px; padding: 14px 0; border-top: 1px solid rgba(255,255,255,.08) }
  .say b { display: block; font-weight: 500 }
  .say i { display: block; font-style: normal; color: rgba(255,255,255,.4); margin-top: 3px; font-size: 12px }
  .big { color: rgba(255,255,255,.85); position: relative; width: 116px; height: 116px; display: grid; place-items: center }
  .keyed::before { content: ''; position: absolute; width: 82.3px; height: 82.3px; border: 1px solid rgba(255,120,120,.28) }
  .worn { display: flex; align-items: flex-end; gap: 26px; color: rgba(255,255,255,.45) }
  .at { display: grid; justify-items: center; gap: 7px }
  .at em { font-style: normal; font-size: 10px; color: rgba(255,255,255,.3) }
  .beside { display: flex; align-items: center; gap: 12px; color: rgba(255,255,255,.45); background: #222; border-radius: 10px; padding: 10px 12px }
</style></head><body>
<h1>A computer, worn at 45% the way the sidebar wears it. The red box is the 17 square keyline.</h1>
${OPTIONS.map(row).join('')}
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('fs')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1000, height: ${180 + OPTIONS.length * 128}, webPreferences: { offscreen: true } })
  await win.loadFile(__dirname + '/index.html')
  await new Promise(r => setTimeout(r, 400))
  const img = await win.webContents.capturePage()
  writeFileSync(${JSON.stringify(shot)}, img.toPNG())
  app.exit(0)
})`

const dir = await realpath(await mkdtemp(path.join(root, 'node_modules/.crew-opts-')))
try {
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  await new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('the window died'))))
    child.on('error', reject)
  })
} finally {
  await rm(dir, { recursive: true, force: true })
}
console.log(shot)
