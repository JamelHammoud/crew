import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

// A mark set at an opacity has to fade as one drawing. Painted a stroke at a
// time it composites its own alpha again wherever two of them cross, so the
// crossing comes out darker than the rest of the mark and the whole thing reads
// as out of focus. Nothing but the pixels can say whether a given mark does
// this: the art is what decides it, and the art is different for every one.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const AT = 64
const ALPHA = 0.45

const ENTRY = `import { createRoot } from 'react-dom/client'
import { createElement, Fragment } from 'react'
import './probe.css'
import * as icons from '${path.join(root, 'src/renderer/src/icons')}'
import * as tools from '${path.join(root, 'src/renderer/src/components/toolGlyphs')}'
import * as docs from '${path.join(root, 'src/renderer/src/components/doc/docGlyphs')}'
import TabIcon from '${path.join(root, 'src/renderer/src/components/TabIcon')}'

const marks = []
for (const [where, set] of [['icons', icons], ['tools', tools], ['docs', docs]]) {
  for (const [name, Icon] of Object.entries(set)) {
    if (!name.endsWith('Glyph') || typeof Icon !== 'function') continue
    marks.push([where + '/' + name, createElement(Icon, { className: 'w-[${AT}px] h-[${AT}px]' })])
  }
}
for (const tab of ['chat', 'docs', 'design']) {
  marks.push(['tab/' + tab, createElement(TabIcon, { tab, size: ${AT} })])
}

createRoot(document.getElementById('root')).render(
  createElement(Fragment, null, marks.map(([say, node]) =>
    createElement('div', { key: say, 'data-say': say, className: 'cell' }, node)
  ))
)
`

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script>
<style>
  /* Said over the app's own base rule, which paints the foreground at full
     strength: the whole of what is being read here is what a mark does when it
     is handed a color that is not. */
  body { margin:0 !important; background:#0a0a0b !important; }
  #root { display:flex; flex-wrap:wrap; }
  .cell { width:${AT}px; height:${AT}px; display:grid; place-items:center;
          color: rgba(255,255,255,${ALPHA}) !important; }
  /* The wrapper opens a fixed slot and clips: the mark's own paint is what is
     being read here, so it is let out of it for the length of the check. */
  .cell .tab-icon { width:auto !important; height:auto !important; overflow:visible !important; }
</style></head>
<body><div id="root"></div></body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1320, height: 900, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    // Every mark is read at rest, so anything still drawing itself in is run out.
    await win.webContents.executeJavaScript(
      'document.getAnimations().forEach(a => a.finish()); 1'
    )
    await wait(300)
    const page = await win.webContents.executeJavaScript(\`JSON.stringify({
      width: innerWidth,
      drawn: document.querySelectorAll('#root svg').length,
      boxes: [...document.querySelectorAll('[data-say]')].map(el => {
        const r = el.getBoundingClientRect()
        return { say: el.dataset.say, x: r.x, y: r.y, w: r.width, h: r.height }
      })
    })\`)
    const shot = await win.webContents.capturePage()
    const bits = shot.toBitmap()
    const size = shot.getSize()
    const { width, boxes, drawn } = JSON.parse(page)
    const scale = size.width / width
    const read = boxes.map(box => {
      const x0 = Math.max(0, Math.round(box.x * scale)), y0 = Math.max(0, Math.round(box.y * scale))
      const x1 = Math.min(size.width, Math.round((box.x + box.w) * scale))
      const y1 = Math.min(size.height, Math.round((box.y + box.h) * scale))
      const hist = new Map()
      let painted = 0, top = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = bits[(y * size.width + x) * 4 + 2]
          if (v < 40) continue
          painted++
          if (v > top) top = v
          hist.set(v, (hist.get(v) || 0) + 1)
        }
      }
      let level = 0, most = 0
      for (const [v, n] of hist) if (n > most) { most = n; level = v }
      let over = 0
      for (const [v, n] of hist) if (v > level + 12) over += n
      return { say: box.say, level, top, painted, over }
    })
    console.log('SEEN ' + JSON.stringify({ drawn, read }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

async function stage() {
  // Staged inside the project rather than in a temp folder of its own, so react
  // and the rest resolve the way they do for any other file here.
  const dir = await realpath(await mkdtemp(path.join(root, 'node_modules/.crew-mark-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
  )
  await writeFile(path.join(dir, 'probe.js'), ENTRY)
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

async function compile(dir) {
  const { build } = await import('vite')
  const react = (await import('@vitejs/plugin-react')).default
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: dir,
    base: './',
    logLevel: 'silent',
    plugins: [react(), tailwind()],
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
  })
  const assets = path.join(dir, 'dist/assets')
  const sheet = (await readdir(assets)).find(name => name.endsWith('.css'))
  if (!sheet) throw new Error('the probe came out with no stylesheet')
  const css = await readFile(path.join(assets, sheet), 'utf8')
  if (!css.includes('tab-icon')) throw new Error('the stylesheet came out without the icon rules in it')
}

const dir = await stage()
let seen
try {
  await compile(dir)
  seen = await new Promise((resolve, reject) => {
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
} finally {
  await rm(dir, { recursive: true, force: true })
}

if (seen.failed) throw new Error(seen.failed)
if (!seen.drawn) throw new Error('the page came up empty, so nothing was really read')

const blank = seen.read.filter(one => one.painted === 0)
const layered = seen.read
  .filter(one => one.painted > 0 && one.over > 0)
  .sort((a, b) => b.over / b.painted - a.over / a.painted)

for (const one of layered) {
  const share = Math.round((one.over / one.painted) * 1000) / 10
  console.log(
    `${one.say.padEnd(30)} drawn at ${String(one.level).padStart(3)}, ${String(one.top).padStart(3)} at its darkest, ${share}% of it laid twice`
  )
}
console.log(
  `\n${seen.read.length} marks read, ${layered.length} of them fade a stroke at a time rather than as one drawing`
)
if (blank.length > 0) console.log(`${blank.length} drew nothing: ${blank.map(one => one.say).join(', ')}`)
if (layered.length > 0) process.exit(1)
