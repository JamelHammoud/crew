import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const out = process.argv[2] ?? path.join(tmpdir(), 'crew-scrim.png')

const smooth = (hold, end, steps = 8) => {
  const stops = [`#000 0 ${hold}px`]
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const y = hold + (end - hold) * t
    const a = 1 - (3 * t * t - 2 * t * t * t)
    stops.push(`rgb(0 0 0 / ${a.toFixed(3)}) ${y.toFixed(1)}px`)
  }
  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

const linear = (hold, end) => `linear-gradient(to bottom, #000 0 ${hold}px, rgb(0 0 0 / 0) ${end}px)`

const CANDIDATES = [
  ['today', 110, linear(70, 110)],
  ['linear 56 to 132', 132, linear(56, 132)],
  ['eased 56 to 120', 120, smooth(56, 120)],
  ['eased 56 to 132', 132, smooth(56, 132)],
  ['eased 56 to 144', 144, smooth(56, 144)],
  ['eased 70 to 150', 150, smooth(70, 150)]
]

const LINES = Array.from(
  { length: 14 },
  (_, i) =>
    `<p class="text-base text-fg">A line of somebody's message, row ${i + 1}, running the width of the column.</p>`
).join('')

const column = ([say, height, mask], index) => `
  <div data-say="${say}" data-x="${index}" class="relative w-[230px] shrink-0 h-[300px] overflow-hidden bg-ink-900">
    <div class="absolute inset-x-0 top-0 h-[210px] bg-fg"></div>
    <div class="absolute inset-x-0 top-0 z-10 pointer-events-none"
         style="height:${height}px;background:var(--color-ink-900);mask-image:${mask};-webkit-mask-image:${mask}"></div>
    <div class="absolute inset-x-0 top-0 z-20 h-[70px] flex items-center px-4 gap-2">
      <span class="w-7 h-7 rounded-full bg-ink-800"></span>
      <span class="text-sm font-medium text-fg">Crew</span>
    </div>
  </div>`

const words = ([say, height, mask]) => `
  <div class="relative w-[300px] shrink-0 h-[300px] overflow-hidden bg-ink-900">
    <div class="absolute inset-0 px-5 space-y-2" style="top:-34px">${LINES}</div>
    <div class="absolute inset-x-0 top-0 z-10 pointer-events-none"
         style="height:${height}px;background:var(--color-ink-900);mask-image:${mask};-webkit-mask-image:${mask}"></div>
    <div class="absolute inset-x-0 top-0 z-20 h-[70px] flex items-center px-4 gap-2">
      <span class="w-7 h-7 rounded-full bg-ink-800"></span>
      <span class="text-sm font-medium text-fg">${say}</span>
    </div>
  </div>`

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 font-sans">
  <div id="root" class="p-0">
    <div id="strip" class="flex">${CANDIDATES.map(column).join('')}</div>
    <div id="prose" class="flex">${CANDIDATES.map(words).join('')}</div>
  </div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${230 * CANDIDATES.length + 40}, height: 640, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(700)
    const read = await win.webContents.executeJavaScript(\`JSON.stringify({
      drawn: document.getElementById('root').innerHTML.length,
      width: innerWidth,
      boxes: [...document.querySelectorAll('[data-say]')].map(el => {
        const r = el.getBoundingClientRect()
        return { say: el.dataset.say, x: r.x, y: r.y, w: r.width, h: r.height }
      })
    })\`)
    const shot = await win.webContents.capturePage()
    fs.writeFileSync(${JSON.stringify(out)}, shot.toPNG())
    const size = shot.getSize()
    const bitmap = shot.toBitmap().toString('base64')
    console.log('SEEN ' + JSON.stringify({ ...JSON.parse(read), size, bitmap }))
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
  return { ink: /--color-ink-900:\s*#141414/.test(css), scrim: css.includes('page-scrim') }
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

const dir = await stage()
try {
  const css = await compile(dir)
  if (!css.ink) throw new Error('the probe came up without the app stylesheet')
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('the page came up empty, so nothing was really read')

  const bitmap = Buffer.from(seen.bitmap, 'base64')
  const scale = seen.size.width / seen.width
  const at = (x, y) => {
    const px = Math.round(x * scale)
    const py = Math.round(y * scale)
    const i = (py * seen.size.width + px) * 4
    return { b: bitmap[i], g: bitmap[i + 1], r: bitmap[i + 2] }
  }

  console.log(`window ${seen.width} wide, shot ${seen.size.width}x${seen.size.height}, scale ${scale}`)
  console.log('reading a column down the middle of each candidate, over a solid white block\n')

  for (const box of seen.boxes) {
    const x = box.x + box.w / 2
    const rows = []
    for (let y = 1; y < 200; y++) {
      const { r, g, b } = at(x, y)
      const lit = (r + g + b) / 3
      rows.push({ y, lit, alpha: Math.max(0, Math.min(1, (255 - lit) / (255 - 20))) })
    }
    let step = { d: 0, y: 0 }
    let kink = { d: 0, y: 0 }
    for (let i = 1; i < rows.length; i++) {
      const d = Math.abs(rows[i].lit - rows[i - 1].lit)
      if (d > step.d) step = { d, y: rows[i].y }
    }
    for (let i = 2; i < rows.length; i++) {
      const d = Math.abs(rows[i].lit - 2 * rows[i - 1].lit + rows[i - 2].lit)
      if (d > kink.d) kink = { d, y: rows[i - 1].y }
    }
    const sample = [40, 56, 60, 70, 80, 90, 100, 110, 120, 128, 132, 140, 144, 150, 160]
      .map(y => `${y}:${rows[y - 1] ? rows[y - 1].alpha.toFixed(2) : '  . '}`)
      .join(' ')
    console.log(`${box.say.padEnd(18)} biggest step ${String(step.d).padStart(3)} at y=${String(step.y).padStart(3)}  biggest kink ${String(kink.d).padStart(3)} at y=${String(kink.y).padStart(3)}`)
    console.log(`${''.padEnd(18)} alpha  ${sample}\n`)
  }
  console.log(`picture written to ${out}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
