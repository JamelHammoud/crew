import { spawn } from 'node:child_process'
import { mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const resolve = createRequire(path.join(root, 'package.json')).resolve

const STATES = {
  busy: {
    sharing: true,
    known: true,
    waiting: 3,
    here: [
      { id: 'ali', name: 'Ali', agent: false, threads: 0 },
      { id: 'bubbles', name: 'Bubbles', agent: true, threads: 2 },
      { id: 'kimi', name: 'Kimi', agent: true, threads: 1 },
      { id: 'codex', name: 'Codex', agent: true, threads: 4 }
    ]
  },
  idle: { sharing: false, known: false, waiting: 0, here: [] }
}

function probeSource() {
  const tray = JSON.stringify(path.join(root, 'src/renderer/src/views/TrayPanel.tsx'))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import TrayPanel from ${tray}
import './probe.css'

const params = new URLSearchParams(location.search)
const state = ${JSON.stringify(STATES)}[params.get('state') || 'busy']
const theme = params.get('theme') === 'light' ? 'light' : 'dark'
window.trayProbe = { height: 0, opened: 0, quit: 0 }
window.crew = {
  onPresence: listener => { queueMicrotask(() => listener(state)); return () => {} },
  onTrayTheme: listener => { queueMicrotask(() => listener(theme)); return () => {} },
  resizeTray: height => { window.trayProbe.height = height },
  openWindow: () => { window.trayProbe.opened++ },
  closeTray: () => {}
}
createRoot(document.getElementById('root')).render(React.createElement(TrayPanel))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function look(win, name, theme) {
  win.setContentSize(272, 520)
  await win.loadFile(path.join(__dirname, 'dist/index.html'), { search: '?state=' + name + '&theme=' + theme })
  await wait(700)
  const wanted = await win.webContents.executeJavaScript('window.trayProbe.height || document.getElementById("root").firstElementChild.offsetHeight')
  const height = Math.max(64, Math.min(wanted, 520))
  win.setContentSize(272, height)
  await wait(200)
  const details = await win.webContents.executeJavaScript(\`(() => {
    const root = document.getElementById('root')
    const buttons = [...document.querySelectorAll('button')]
    return {
      width: root.offsetWidth,
      height: root.offsetHeight,
      content: root.firstElementChild.offsetHeight,
      scrolls: root.scrollWidth > root.clientWidth,
      buttons: buttons.map(button => button.textContent.trim()),
      theme: document.documentElement.classList.contains('light') ? 'light' : 'dark'
    }
  })()\`)
  const image = await win.capturePage()
  fs.writeFileSync(path.join(${JSON.stringify(root)}, 'tray-look-' + name + '-' + theme + '.png'), image.toPNG())
  return details
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 272, height: 520, show: true, frame: false, transparent: true })
  try {
    const busy = await look(win, 'busy', 'dark')
    const idle = await look(win, 'idle', 'light')
    console.log('SEEN ' + JSON.stringify({ busy, idle }))
  } catch (error) {
    console.log('SEEN ' + JSON.stringify({ failed: String(error && error.message) }))
  }
  win.destroy()
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-tray-look-')))
  await writeFile(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>'
  )
  await writeFile(path.join(dir, 'probe.tsx'), probeSource())
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`
  )
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
}

function run(dir) {
  return new Promise((accept, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    child.on('exit', () => {
      const line = out.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error('the window said nothing back'))
      accept(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const dir = await stage()
await compile(dir)
const seen = await run(dir)
if (seen.failed) throw new Error(seen.failed)

for (const [name, state] of Object.entries(seen)) {
  if (state.width !== 272 || state.content > state.height || state.scrolls) {
    throw new Error(`${name} tray measured ${state.width} x ${state.height}, held ${state.content}, scrolls ${state.scrolls}`)
  }
}

console.log(`\nbusy tray   ${seen.busy.width} x ${seen.busy.height}, ${seen.busy.theme}`)
console.log(`idle tray   ${seen.idle.width} x ${seen.idle.height}, ${seen.idle.theme}`)
console.log(`\nshots written beside the project as tray-look-*.png`)
