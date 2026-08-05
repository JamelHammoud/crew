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
  ['linear 48 to 112', 112, linear(48, 112)],
  ['eased 56 to 112', 112, smooth(56, 112)],
  ['eased 48 to 112', 112, smooth(48, 112)],
  ['eased 40 to 112', 112, smooth(40, 112)],
  ['eased 48 to 128', 128, smooth(48, 128)]
]

const WIDE = 236
const LINES = Array.from(
  { length: 16 },
  (_, i) => `<p class="text-base text-fg">Row ${i + 1} of a message somebody wrote here.</p>`
).join('')

const column = ([say, height, mask], index) => {
  const scrim = `<div class="absolute inset-x-0 top-0 z-10 pointer-events-none" style="height:${height}px;background:var(--color-ink-900);mask-image:${mask};-webkit-mask-image:${mask}"></div>`
  const bar = `<div class="absolute inset-x-0 top-0 z-20 h-[70px] flex items-center px-4 gap-2"><span class="w-7 h-7 rounded-full bg-ink-800"></span><span class="text-sm font-medium text-fg">${say}</span></div>`
  return `
  <div data-say="${say}" data-lit="${index}" class="relative shrink-0 h-[260px] overflow-hidden bg-ink-900" style="width:${WIDE}px">
    <div class="absolute inset-x-0 top-0 h-[200px] bg-fg"></div>${scrim}${bar}
  </div>
  <div data-words="${say}" class="relative shrink-0 h-[260px] overflow-hidden bg-ink-900" style="width:${WIDE}px">
    <div class="absolute inset-x-0 px-5 space-y-2" style="top:-26px">${LINES}</div>${scrim}${bar}
  </div>`
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 font-sans">
  <div id="root"><div class="flex flex-wrap" style="width:${WIDE * 4}px">${CANDIDATES.map(column).join('')}</div></div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDE * 4}, height: 800, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(800)
    const read = JSON.parse(await win.webContents.executeJavaScript(\`JSON.stringify({
      drawn: document.getElementById('root').innerHTML.length,
      width: innerWidth,
      boxes: [...document.querySelectorAll('[data-lit]')].map(el => {
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
      const x = box.x + box.w - 24
      const rows = []
      for (let y = 0; y < 200; y++) rows.push(Math.round(lit(x, box.y + y + 0.5)))
      return { say: box.say, rows }
    })
    console.log('SEEN ' + JSON.stringify({ drawn: read.drawn, width: read.width, size, scale, columns }))
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
  return { ink: /--color-ink-900:\s*#141414/.test(css) }
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
const SAMPLE = [40, 56, 64, 70, 80, 90, 100, 110, 120, 128, 132, 140, 144, 150, 160]

const dir = await stage()
try {
  const css = await compile(dir)
  if (!css.ink) throw new Error('the probe came up without the app stylesheet')
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('the page came up empty, so nothing was really read')

  console.log(`window ${seen.width} wide, shot ${seen.size.width}x${seen.size.height}, scale ${seen.scale}\n`)
  console.log('a column read down the middle of each candidate, over a solid white block.')
  console.log('alpha is how much ink is left standing over the white at that row.\n')

  for (const { say, rows } of seen.columns) {
    const alpha = rows.map(v => Math.max(0, Math.min(1, (PAPER - v) / (PAPER - INK))))
    let step = { d: 0, y: 0 }
    let kink = { d: 0, y: 0 }
    for (let y = 1; y < rows.length; y++) {
      const d = Math.abs(rows[y] - rows[y - 1])
      if (d > step.d) step = { d, y }
    }
    for (let y = 2; y < rows.length; y++) {
      const d = Math.abs(rows[y] - 2 * rows[y - 1] + rows[y - 2])
      if (d > kink.d) kink = { d, y: y - 1 }
    }
    const clear = alpha.findIndex((a, y) => y > 40 && a <= 0.01)
    console.log(
      `${say.padEnd(17)} biggest step ${String(step.d).padStart(3)} at y=${String(step.y).padStart(3)}   biggest kink ${String(kink.d).padStart(3)} at y=${String(kink.y).padStart(3)}   clear by y=${clear}`
    )
    console.log(`${''.padEnd(17)} ${SAMPLE.map(y => `${y}:${alpha[y].toFixed(2)}`).join('  ')}\n`)
  }
  console.log(`picture written to ${out}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
