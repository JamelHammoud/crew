import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import electron from 'electron'

const root = '/Users/jamel/Documents/Repositories/crew'
const resolve = createRequire(path.join(root, 'package.json')).resolve

const WIDTH = 900
const HEIGHT = 320

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import PanelToggle from ${from('components/PanelToggle.tsx')}
import { useBrowser } from ${from('state/browser.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
useCrew.setState({
  openThreadId: 't1',
  openThreadIds: ['t1'],
  events: [],
  threads: {
    t1: {
      id: 't1',
      agentId: 'a1',
      agentLabel: 'Bubbles',
      title: 'A thread',
      createdBy: 'Jamel',
      status: 'open',
      mode: 'build',
      plan: 'Step one'
    }
  }
})

function Row({ zoom }) {
  return React.createElement(
    'div',
    { className: 'flex items-center gap-6 px-6 py-4 bg-ink-900' },
    React.createElement(
      'div',
      { style: { zoom }, className: 'flex items-center' },
      React.createElement(PanelToggle)
    ),
    React.createElement('span', { className: 'text-fg-muted text-sm' }, zoom + 'x')
  )
}

createRoot(document.getElementById('root')).render(
  React.createElement(
    'div',
    { className: 'h-full bg-ink-900 flex flex-col items-start justify-center' },
    React.createElement(Row, { zoom: 1 }),
    React.createElement(Row, { zoom: 4 })
  )
)
`
}

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-toggle-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))
const OUT = ${JSON.stringify(path.join(shots, 'toggle.png'))}
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    const shot = await win.webContents.capturePage()
    await writeFile(OUT, shot.toPNG())
    console.log('SEEN ' + OUT)
  } catch (e) {
    console.log('SEEN failed ' + String(e && e.stack))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-toggle-')))
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
      accept(line.slice(5))
    })
    child.on('error', reject)
  })
}

const dir = await stage()
await compile(dir)
console.log(await run(dir))
