import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans"><div class="p-4">
<button id="del" class="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-danger shift:flex">x</button>
</div></body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))
const read = win => win.webContents.executeJavaScript(\`JSON.stringify({
  attr: document.documentElement.hasAttribute('data-shift'),
  display: getComputedStyle(document.getElementById('del')).display
})\`)
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 400, height: 300, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(600)
    const rest = await read(win)
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Shift', modifiers: ['shift'] })
    await wait(200)
    const held = await read(win)
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Shift' })
    await wait(200)
    const let_go = await read(win)
    console.log('SEEN ' + JSON.stringify({ rest: JSON.parse(rest), held: JSON.parse(held), let_go: JSON.parse(let_go) }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-shift-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
  )
  await writeFile(
    path.join(dir, 'probe.js'),
    `import './probe.css'\nimport { watchShift } from '${path.join(root, 'src/renderer/src/state/shift.ts')}'\nwatchShift()\n`
  )
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

const dir = await stage()
const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({ root: dir, base: './', logLevel: 'silent', plugins: [tailwind()], build: { outDir: path.join(dir, 'dist'), emptyOutDir: true } })
const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
let out = ''
child.stdout.on('data', d => (out += d))
child.stderr.on('data', () => {})
await new Promise(r => child.on('exit', r))
const line = out.split('\n').find(l => l.startsWith('SEEN '))
console.log(line ? JSON.stringify(JSON.parse(line.slice(5)), null, 2) : 'nothing came back\n' + out)
await rm(dir, { recursive: true, force: true })
