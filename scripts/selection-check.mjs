import { spawn } from 'node:child_process'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

// What a drag or a select all really takes away is the one thing no source test
// can read. The rule is a default on the body and a handful of utilities over
// it, and whether a browser honors that for a given box is a question about the
// browser: a placeholder sat inside the rule that opens a field back up, so
// every field in the app painted a line of the app's own words on a select all,
// and the suite that reads the stylesheet passed the whole time.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const CONTENT = 'CONTENT what somebody wrote'
const CHROME = [
  ['a heading', '<h2 class="text-lg font-semibold text-fg">CHROME a heading</h2>'],
  ['a label', '<span class="text-xs text-fg-muted">CHROME a label</span>'],
  ['a button', '<button class="px-3 h-9 rounded-full bg-ink-800 text-fg-secondary">CHROME a button</button>'],
  ['a tab', '<div class="px-3 h-8 rounded-full bg-fg/[0.06] text-sm text-fg-secondary">CHROME a tab</div>'],
  ['an empty state', '<p class="text-sm text-fg-muted">CHROME nothing here yet</p>'],
  ['a pill', '<span class="px-2 py-0.5 rounded-full bg-ink-700 text-xs text-fg">CHROME a pill</span>'],
  ['a count', '<span class="text-xs tabular-nums text-positive">CHROME 18 files changed</span>'],
  ['a field placeholder', '<textarea rows="2" placeholder="CHROME say something" class="w-72 bg-ink-800 text-fg"></textarea>'],
  ['a search placeholder', '<input placeholder="CHROME find in project" class="w-72 bg-ink-800 text-fg">'],
]

const PAGE = `<!doctype html>
<html class="dark"><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans">
  <div id="root" class="p-4 space-y-3">
    <div class="md select-text"><p>${CONTENT}</p></div>
    ${CHROME.map(([, markup]) => `<div>${markup}</div>`).join('\n    ')}
  </div>
</body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms))
  const win = new BrowserWindow({ width: 700, height: 600, show: false })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(600)
    const drawn = await win.webContents.executeJavaScript('document.getElementById("root").innerHTML.length')
    win.webContents.selectAll()
    await wait(300)
    const took = await win.webContents.executeJavaScript('getSelection().toString()')
    console.log('SEEN ' + JSON.stringify({ drawn, took }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-selection-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
  )
  await writeFile(path.join(dir, 'probe.js'), "import './probe.css'\n")
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
  const css = await readFile(path.join(dir, 'dist/probe.css'), 'utf8').catch(async () => {
    const assets = path.join(dir, 'dist/assets')
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(assets)
    return readFile(path.join(assets, files.find(name => name.endsWith('.css'))), 'utf8')
  })
  if (!css.includes('user-select')) throw new Error('the stylesheet came out with no selection rule in it')

  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('the page came up empty, so nothing was really tested')

  const problems = []
  if (!seen.took.includes(CONTENT)) problems.push('content did not come away, and it is the one thing that should')
  for (const [name, markup] of CHROME) {
    const words = markup.match(/CHROME[^<"]*/)[0].trim()
    if (seen.took.includes(words)) problems.push(`${name} came away with the selection`)
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem)
    process.exit(1)
  }
  console.log(`a select all took the content and none of the ${CHROME.length} pieces of chrome`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
