import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

// What a select all really paints is the one thing no source test can read. The
// rule is a default on the body and a handful of utilities over it, and whether
// a browser honors it for a given box is a question about the browser: a
// placeholder sat inside the rule that opens a field back up, so every field in
// the app painted a line of the app's own words on a select all, and the suite
// that reads the stylesheet passed the whole time. Reading the selection back is
// not enough either, since a placeholder is painted over and never copied. This
// looks at the pixels.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

// The renderer loads these too, and every one of them is unlayered, so what they
// say about selection beats anything in a layer however it is written. tldraw's
// input { user-select: text } arrives with the first board somebody opens and
// turned the placeholder rule off from then on, which is a bug that only exists
// in a document holding both stylesheets.
const LIBRARY = ['tldraw/tldraw.css', '@xterm/xterm/css/xterm.css', '@blocknote/mantine/style.css']

const FIXTURE = [
  ['what somebody wrote', 'content', '<div class="md select-text"><p>a message somebody wrote, worth copying</p></div>'],
  ['a heading', 'chrome', '<h2 class="text-lg font-semibold text-fg">A heading</h2>'],
  ['a label', 'chrome', '<span class="text-xs text-fg-muted">A label</span>'],
  ['a button', 'chrome', '<button class="px-3 h-9 rounded-full bg-ink-800 text-fg-secondary">Mark done</button>'],
  ['a tab', 'chrome', '<div class="px-3 h-8 rounded-full bg-fg/[0.06] text-sm text-fg-secondary">Board</div>'],
  ['an empty state', 'chrome', '<p class="text-sm text-fg-muted">Nothing on the board yet</p>'],
  ['a status', 'chrome', '<span class="text-sm text-fg">Ready for review</span>'],
  ['a count', 'chrome', '<span class="text-xs tabular-nums text-positive">18 files changed</span>'],
  ['a placeholder', 'chrome', '<textarea rows="2" placeholder="Send a message or @ someone" class="w-72 bg-ink-800 text-fg"></textarea>'],
  ['a search placeholder', 'chrome', '<input placeholder="Find in project" class="w-72 bg-ink-800 text-fg">'],
]

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans">
  <div id="root" class="p-4 space-y-4">
    ${FIXTURE.map(([say, kind, markup]) => `<div data-say="${say}" data-kind="${kind}" class="w-fit">${markup}</div>`).join('\n    ')}
  </div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 760, height: 640, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(600)
    const page = await win.webContents.executeJavaScript(\`JSON.stringify({
      drawn: document.getElementById('root').innerHTML.length,
      width: innerWidth,
      boxes: [...document.querySelectorAll('[data-say]')].map(el => {
        const r = el.getBoundingClientRect()
        return { say: el.dataset.say, kind: el.dataset.kind, x: r.x, y: r.y, w: r.width, h: r.height }
      })
    })\`)
    const before = (await win.webContents.capturePage()).toBitmap()
    win.webContents.selectAll()
    await wait(400)
    const took = await win.webContents.executeJavaScript('getSelection().toString()')
    const shot = await win.webContents.capturePage()
    const after = shot.toBitmap()
    const size = shot.getSize()
    console.log('SEEN ' + JSON.stringify({
      ...JSON.parse(page),
      took,
      size,
      moved: [...JSON.parse(page).boxes].map(box => count(before, after, size, box, JSON.parse(page).width))
    }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})

function count(before, after, size, box, width) {
  const scale = size.width / width
  const x0 = Math.max(0, Math.floor(box.x * scale))
  const y0 = Math.max(0, Math.floor(box.y * scale))
  const x1 = Math.min(size.width, Math.ceil((box.x + box.w) * scale))
  const y1 = Math.min(size.height, Math.ceil((box.y + box.h) * scale))
  let moved = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const at = (y * size.width + x) * 4
      if (before[at] !== after[at] || before[at + 1] !== after[at + 1] || before[at + 2] !== after[at + 2]) moved++
    }
  }
  return moved
}`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-selection-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
  )
  const after = LIBRARY.map(name => `import '${name}'`).join('\n')
  await writeFile(path.join(dir, 'probe.js'), `import './probe.css'\n${after}\n`)
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
  if (!css.includes('user-select')) throw new Error('the stylesheet came out with no selection rule in it')
}

function run(dir) {
  return new Promise((resolve, reject) => {
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
}

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('the page came up empty, so nothing was really tested')

  const problems = []
  seen.boxes.forEach((box, at) => {
    const moved = seen.moved[at]
    if (box.kind === 'content' && moved === 0) problems.push(`${box.say} was not painted, and it is the one thing that should be`)
    if (box.kind === 'chrome' && moved > 0) problems.push(`${box.say} was painted by the selection, ${moved} pixels of it`)
  })
  if (!seen.took.includes('worth copying')) problems.push('content did not come away with the selection')
  for (const [say] of FIXTURE) {
    if (say !== 'what somebody wrote' && seen.took.includes(say)) problems.push(`${say} came away with the selection`)
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(problem)
    process.exit(1)
  }
  const chrome = seen.boxes.filter(box => box.kind === 'chrome').length
  console.log(`a select all painted the content and none of the ${chrome} pieces of chrome`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
