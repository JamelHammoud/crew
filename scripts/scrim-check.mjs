import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ?? path.join(tmpdir(), 'crew-scrim.png')

const WIDE = 470
const LINES = Array.from(
  { length: 20 },
  (_, i) =>
    `<p class="text-base text-fg">Row ${i + 1}. A line of a message somebody wrote, running the width of the column.</p>`
).join('')

const BAR = `
  <div class="app-drag h-[70px] px-4 flex items-center gap-2">
    <span class="w-7 h-7 rounded-full bg-ink-800"></span>
    <span class="w-7 h-7 -ml-3 rounded-full bg-ink-700"></span>
    <span class="ml-1 text-sm font-medium text-fg">Jamel</span>
    <span class="ml-auto w-8 h-8 rounded-full bg-ink-800"></span>
  </div>`

const page = (say, chrome, content) => `
  <div data-say="${say}" class="${say.startsWith('light') ? 'light ' : ''}relative shrink-0 h-[300px] overflow-hidden bg-ink-900" style="width:${WIDE}px">
    <div class="absolute inset-0 overflow-hidden">${content}</div>
    <div class="absolute top-0 inset-x-0 z-40 pointer-events-none">${chrome}</div>
  </div>`

const SCRIM = `<div class="page-scrim absolute inset-x-0 top-0"></div><div class="top-bar-container relative pointer-events-auto">${BAR}</div>`
const BAND = `<div class="top-bar-container relative pointer-events-auto bg-ink-900">${BAR}</div>`
const TODAY = `<div class="top-bar-container pointer-events-auto bg-ink-900">${BAR}</div><div class="h-10 bg-gradient-to-b from-ink-900 to-transparent"></div>`

const LIT = '<div class="absolute inset-x-0 top-0 h-[240px] bg-fg"></div>'
const SCROLLED = `<div class="absolute inset-x-0 px-6 space-y-2" style="top:-30px">${LINES}</div>`
const RESTING = `<div class="absolute inset-x-0 px-6 space-y-2" style="top:var(--page-scrim)">${LINES}</div>`

const CASES = [
  ['today lit', TODAY, LIT],
  ['scrim lit', SCRIM, LIT],
  ['design lit', BAND, LIT],
  ['today scrolled', TODAY, SCROLLED],
  ['scrim scrolled', SCRIM, SCROLLED],
  ['scrim resting', SCRIM, RESTING],
  ['light lit', SCRIM, LIT]
]

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 font-sans">
  <div id="root"><div class="flex flex-wrap" style="width:${WIDE * 2}px">${CASES.map(one => page(...one)).join('')}</div></div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDE * 2}, height: 940, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(800)
    const read = JSON.parse(await win.webContents.executeJavaScript(\`JSON.stringify({
      drawn: document.getElementById('root').innerHTML.length,
      width: innerWidth,
      scrim: getComputedStyle(document.documentElement).getPropertyValue('--page-scrim').trim(),
      masked: [...document.querySelectorAll('.page-scrim')].every(el => getComputedStyle(el).maskImage.includes('gradient')),
      boxes: [...document.querySelectorAll('[data-say]')].map(el => {
        const r = el.getBoundingClientRect()
        return { say: el.dataset.say, x: r.x, y: r.y, w: r.width, h: r.height }
      })
    })\`))
    const shot = await win.webContents.capturePage()
    fs.writeFileSync(${JSON.stringify(out)}, shot.toPNG())
    const size = shot.getSize()
    const bitmap = shot.toBitmap()
    const scale = size.width / read.width
    const lit = (x, y) => {
      const i = (Math.round(y * scale) * size.width + Math.round(x * scale)) * 4
      return (bitmap[i] + bitmap[i + 1] + bitmap[i + 2]) / 3
    }
    const columns = read.boxes.map(box => {
      const rows = []
      for (let y = 0; y < 210; y++) {
        let sum = 0
        let seen = 0
        for (let x = 170; x < box.w - 90; x += 4) {
          sum += lit(box.x + x, box.y + y + 0.5)
          seen++
        }
        rows.push(Math.round((sum / seen) * 10) / 10)
      }
      return { say: box.say, rows }
    })
    console.log('SEEN ' + JSON.stringify({ ...read, boxes: undefined, size, scale, columns }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-scrim-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n@source "${path.join(dir, 'index.html')}";\n`
  )
  await writeFile(path.join(dir, 'probe.js'), `import './probe.css'\n`)
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

async function compile(dir) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: dir,
    base: './',
    logLevel: 'silent',
    plugins: [tailwind()],
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
  })
  const assets = path.join(dir, 'dist/assets')
  const files = await readdir(assets)
  const sheet = files.find(name => name.endsWith('.css'))
  if (!sheet) throw new Error('the probe came out with no stylesheet')
  const css = await readFile(path.join(assets, sheet), 'utf8')
  if (!/--color-ink-900:\s*#141414/.test(css)) throw new Error('the probe came up without the app stylesheet')
  if (!css.includes('.page-scrim')) throw new Error('the stylesheet came out with no .page-scrim in it')
}

function run(dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let said = ''
    child.stdout.on('data', chunk => (said += chunk))
    child.stderr.on('data', () => {})
    child.on('exit', () => {
      const line = said.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error('the window said nothing back'))
      resolve(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const INK = 20
const PAPER = 255
const SAMPLE = [30, 48, 56, 64, 70, 80, 90, 100, 106, 110, 112, 116, 120, 130]

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('the page came up empty, so nothing was really read')

  console.log(`window ${seen.width} wide, shot ${seen.size.width}x${seen.size.height}, scale ${seen.scale}`)
  console.log(`--page-scrim reads ${seen.scrim}, every .page-scrim really wears its ramp: ${seen.masked}\n`)

  for (const { say, rows } of seen.columns) {
    const lit = say.endsWith('lit')
    const back = say.startsWith('light') ? INK : PAPER
    const over = say.startsWith('light') ? PAPER : INK
    const alpha = rows.map(v => Math.max(0, Math.min(1, (back - v) / (back - over))))
    let step = { d: 0, y: 0 }
    let kink = { d: 0, y: 0 }
    for (let y = 1; y < rows.length; y++) {
      const d = Math.abs(rows[y] - rows[y - 1])
      if (d > step.d) step = { d: Math.round(d * 10) / 10, y }
    }
    for (let y = 2; y < rows.length; y++) {
      const d = Math.abs(rows[y] - 2 * rows[y - 1] + rows[y - 2])
      if (d > kink.d) kink = { d: Math.round(d * 10) / 10, y: y - 1 }
    }
    console.log(
      `${say.padEnd(16)} biggest step ${String(step.d).padStart(5)} at y=${String(step.y).padStart(3)}   biggest kink ${String(kink.d).padStart(5)} at y=${String(kink.y).padStart(3)}`
    )
    if (lit) console.log(`${''.padEnd(16)} ink left standing  ${SAMPLE.map(y => `${y}:${alpha[y].toFixed(2)}`).join('  ')}`)
    else console.log(`${''.padEnd(16)} row brightness     ${SAMPLE.map(y => `${y}:${rows[y].toFixed(0)}`).join('  ')}`)
    console.log('')
  }
  console.log(`picture written to ${out}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
