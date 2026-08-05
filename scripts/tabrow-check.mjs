import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const PILLS = Array.from({ length: 8 }, (_, i) => `<div class="shrink-0 h-9 px-3 rounded-full bg-ink-800 text-sm text-fg flex items-center">Pill ${i + 1}</div>`).join('')

const ROWS = [
  ['a', 'flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]'],
  ['b', 'flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'],
  ['c', 'flex items-center gap-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none]'],
]

const BARE = `<div id="row" style="width:380px;display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:none">${PILLS.replace(/class="[^"]*"/g, 'style="flex:0 0 auto;height:36px;padding:0 12px;display:flex;align-items:center;background:#222;color:#fff"')}</div>`

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans">
  <div id="root" class="p-4 space-y-6">
    ${ROWS.map(([say, cls]) => `<div class="w-[380px]"><div data-say="${say}" class="${cls}">${PILLS}</div></div>`).join('\n    ')}
    <iframe id="bare" srcdoc='<!doctype html><body style="margin:0">${BARE}</body>' style="width:420px;height:120px;border:0"></iframe>
  </div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))

const READ = \`(el => ({
  offsetHeight: el.offsetHeight,
  clientHeight: el.clientHeight,
  scrollHeight: el.scrollHeight,
  offsetWidth: el.offsetWidth,
  clientWidth: el.clientWidth,
  scrollWidth: el.scrollWidth,
  overflowX: getComputedStyle(el).overflowX,
  overflowY: getComputedStyle(el).overflowY,
  scrollbarWidth: getComputedStyle(el).scrollbarWidth,
}))\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 760, height: 800, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(800)
    const seen = await win.webContents.executeJavaScript(\`(() => {
      const read = \${READ}
      const rows = {}
      for (const el of document.querySelectorAll('[data-say]')) {
        const before = read(el)
        el.lastElementChild.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        rows[el.dataset.say] = { ...before, scrollTop: el.scrollTop, scrollLeft: el.scrollLeft }
      }
      const bare = document.getElementById('bare').contentDocument.getElementById('row')
      const bareBefore = read(bare)
      bare.lastElementChild.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      rows.d = { ...bareBefore, scrollTop: bare.scrollTop, scrollLeft: bare.scrollLeft }
      return JSON.stringify({ drawn: document.getElementById('root').innerHTML.length, rows })
    })()\`)
    console.log('SEEN ' + seen)
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-tabrow-')))
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
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true },
  })
  const assets = path.join(dir, 'dist/assets')
  const files = await readdir(assets)
  const sheet = files.find(name => name.endsWith('.css'))
  if (!sheet) throw new Error('the probe came out with no stylesheet')
  const css = await readFile(path.join(assets, sheet), 'utf8')
  return {
    global: /(^|\})::-webkit-scrollbar\{/.test(css) || css.includes('::-webkit-scrollbar{width:10px'),
    hidden: css.includes('::-webkit-scrollbar{display:none'),
    none: css.includes('scrollbar-width:none'),
  }
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

const SAYS = {
  a: 'overflow-x-auto + [scrollbar-width:none], global ::-webkit-scrollbar in the sheet',
  b: 'the same + [&::-webkit-scrollbar]:hidden',
  c: 'the same as a, plus overflow-y-hidden',
  d: 'control: an iframe with no app stylesheet at all',
}

const dir = await stage()
try {
  const css = await compile(dir)
  console.log('stylesheet: global scrollbar rule ' + (css.global ? 'present' : 'MISSING') + ', a scoped display:none ' + (css.hidden ? 'present' : 'MISSING') + ', scrollbar-width:none ' + (css.none ? 'present' : 'MISSING'))
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('the page came up empty, so nothing was really tested')
  for (const [say, row] of Object.entries(seen.rows)) {
    console.log(`\n${say}: ${SAYS[say]}`)
    console.log(`  offsetHeight ${row.offsetHeight}  clientHeight ${row.clientHeight}  scrollHeight ${row.scrollHeight}  (gutter ${row.offsetHeight - row.clientHeight})`)
    console.log(`  offsetWidth ${row.offsetWidth}  clientWidth ${row.clientWidth}  scrollWidth ${row.scrollWidth}`)
    console.log(`  computed overflow ${row.overflowX} / ${row.overflowY}, scrollbar-width ${row.scrollbarWidth}`)
    console.log(`  after scrollIntoView on the last pill: scrollTop ${row.scrollTop}, scrollLeft ${row.scrollLeft}`)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}
