import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const OUT = '/tmp/columns-look'

const CASES = [
  { width: 1200, count: 2 },
  { width: 1200, count: 3 },
  { width: 1200, count: 5 },
  { width: 1600, count: 2 },
  { width: 1600, count: 3 },
  { width: 1600, count: 5 },
  { width: 900, count: 2 },
  { width: 900, count: 3 },
  { width: 900, count: 5 },
]

const PAGE = `<!doctype html>
<html class="h-full"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="h-full bg-ink-900 text-fg font-sans">
  <div id="root" class="h-full"></div>
</body></html>`

const PROBE = `import './probe.css'

const FILL = 'The agent read the file, worked out what had changed in it and wrote the diff back. A few lines of filler so the column has something to scroll past.'

function column(at) {
  return \`
  <div data-column="\${at}" style="min-width:460px" class="h-full flex-1 relative border-l border-ink-700 first:border-l-0">
    <div class="h-full flex">
      <div class="flex-1 min-w-0 relative">
        <div data-scroller="\${at}" class="h-full overflow-y-auto overflow-x-hidden px-6">
          <div class="max-w-[660px] mx-auto pt-28 space-y-5" style="padding-bottom:120px">
            \${Array.from({ length: 8 }, (_, i) => \`<p class="text-sm text-fg-secondary select-text">\${i + 1}. \${FILL}</p>\`).join('')}
          </div>
        </div>
        <div data-overlay="\${at}" class="absolute inset-x-0 bottom-0 pointer-events-none">
          <div class="h-14 bg-gradient-to-t from-ink-900 to-transparent"></div>
          <div class="bg-ink-900 px-6 pb-6">
            <div class="relative max-w-[660px] mx-auto pointer-events-auto">
              <div data-head="\${at}" class="relative bg-ink-900 border border-b-0 border-ink-700 rounded-t-[30px] pb-12 -mb-9">
                <div class="flex items-center gap-3 px-3 pt-2.5">
                  <div class="w-10 h-10 rounded-full bg-ink-800 shrink-0"></div>
                  <div class="w-10 h-10 rounded-full bg-ink-800 shrink-0"></div>
                  <div class="min-w-0 flex-1">
                    <div class="text-base font-bold text-fg truncate">Thread \${at + 1}</div>
                    <div class="text-xs text-fg-muted truncate">What the thread was opened on</div>
                  </div>
                  <div class="ml-auto flex items-center gap-2 shrink-0">
                    <span class="text-base font-semibold text-fg">Done</span>
                    <div class="h-10 px-4 rounded-full bg-ink-800 text-sm font-semibold text-fg-secondary flex items-center">Mark done</div>
                    <div class="w-10 h-10 rounded-full bg-ink-800"></div>
                  </div>
                </div>
              </div>
              <div data-composer="\${at}" class="relative rounded-shell border border-ink-700 bg-ink-800 h-[104px]"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>\`
}

window.setColumns = n => {
  document.getElementById('root').innerHTML =
    \`<div id="row" class="h-full flex overflow-x-auto overflow-y-hidden">\${Array.from({ length: n }, (_, i) => column(i)).join('')}</div>\`
  return document.querySelectorAll('[data-column]').length
}

window.setColumns(2)
`

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()

const CASES = ${JSON.stringify(CASES)}
const OUT = ${JSON.stringify(OUT)}
const wait = ms => new Promise(r => setTimeout(r, ms))

const READ = at => \`JSON.stringify((() => {
  const row = document.getElementById('row')
  const rowBox = row.getBoundingClientRect()
  const columns = [...document.querySelectorAll('[data-column]')].map(el => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return { x: Math.round(r.x * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, borderLeft: s.borderLeftWidth, offsetW: el.offsetWidth, clientW: el.clientWidth }
  })
  const boxOf = sel => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, bottom: Math.round(r.bottom * 100) / 100, right: Math.round(r.right * 100) / 100 }
  }
  const last = columns.length - 1
  const scroller = document.querySelector('[data-scroller="0"]')
  return {
    at: \${JSON.stringify(at)},
    innerWidth, innerHeight,
    row: { x: rowBox.x, y: rowBox.y, w: rowBox.width, h: rowBox.height, bottom: rowBox.bottom, clientWidth: row.clientWidth, scrollWidth: row.scrollWidth, clientHeight: row.clientHeight, offsetHeight: row.offsetHeight, scrollLeft: Math.round(row.scrollLeft), maxScroll: row.scrollWidth - row.clientWidth },
    columns,
    firstOverlay: boxOf('[data-overlay="0"]'),
    lastOverlay: boxOf('[data-overlay="' + last + '"]'),
    firstComposer: boxOf('[data-composer="0"]'),
    lastComposer: boxOf('[data-composer="' + last + '"]'),
    scroller: scroller ? { clientWidth: scroller.clientWidth, offsetWidth: scroller.offsetWidth, clientHeight: scroller.clientHeight, offsetHeight: scroller.offsetHeight, scrollHeight: scroller.scrollHeight } : null
  }
})())\`

function seams(bitmap, size, geo) {
  const scale = size.width / geo.innerWidth
  const y = Math.round(20 * scale)
  const at = x => {
    const i = (y * size.width + x) * 4
    return '#' + [bitmap[i + 2], bitmap[i + 1], bitmap[i]].map(v => v.toString(16).padStart(2, '0')).join('')
  }
  return geo.columns.slice(1).map((col, i) => {
    const px = Math.round(col.x * scale)
    const strip = []
    for (let x = px - 4; x <= px + 4; x++) if (x >= 0 && x < size.width) strip.push(at(x))
    const lit = strip.filter(c => c !== '#141414').length
    return { column: i + 1, x: col.x, scale, strip, litDevicePixels: lit }
  })
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const win = new BrowserWindow({ width: 1200, height: 800, show: true })
  const said = []
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(500)
    for (const one of CASES) {
      win.setContentSize(one.width, 800)
      await wait(200)
      const drawn = await win.webContents.executeJavaScript('window.setColumns(' + one.count + ')')
      await wait(250)
      const geo = JSON.parse(await win.webContents.executeJavaScript(READ(one)))
      geo.drawn = drawn
      const shot = await win.webContents.capturePage()
      const name = one.width + 'w-' + one.count + 'col'
      fs.writeFileSync(path.join(OUT, name + '.png'), shot.toPNG())
      geo.seams = seams(shot.toBitmap(), shot.getSize(), geo)
      geo.shot = path.join(OUT, name + '.png')
      let end = null
      if (geo.row.maxScroll > 0) {
        await win.webContents.executeJavaScript('document.getElementById("row").scrollLeft = 1e6')
        await wait(250)
        end = JSON.parse(await win.webContents.executeJavaScript(READ(one)))
        const tail = await win.webContents.capturePage()
        fs.writeFileSync(path.join(OUT, name + '-end.png'), tail.toPNG())
        end.shot = path.join(OUT, name + '-end.png')
      }
      geo.end = end
      said.push(geo)
    }
    console.log('SEEN ' + JSON.stringify(said))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-columns-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
  )
  await writeFile(path.join(dir, 'probe.js'), PROBE)
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
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true },
  })
  const assets = path.join(dir, 'dist/assets')
  const files = await readdir(assets)
  const sheet = files.find(name => name.endsWith('.css'))
  if (!sheet) throw new Error('the probe came out with no stylesheet')
  const css = await readFile(path.join(assets, sheet), 'utf8')
  if (!css.includes('--color-ink-700')) throw new Error('the stylesheet came out without the tokens in it')
  if (!css.includes('::-webkit-scrollbar')) throw new Error('the stylesheet came out without the scrollbar rule in it')
}

function run(dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    child.on('exit', () => {
      const line = out.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error('the window said nothing back\n' + out))
      resolve(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  console.log(JSON.stringify(seen, null, 2))
} finally {
  await rm(dir, { recursive: true, force: true })
}
