import { spawn } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const resolve = createRequire(path.join(root, 'package.json')).resolve
const shot = path.join(tmpdir(), 'crew-stickies-look.png')

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import StickiesWindow from ${from('views/StickiesWindow.tsx')}
import './probe.css'

const now = Date.now()
let stickies = [
  { id: 'first', title: 'Named note', body: 'A short preview', color: 'yellow', pinned: false, createdAt: now - 2000, updatedAt: now - 1000 },
  { id: 'second', body: 'Body first note', color: 'blue', pinned: false, createdAt: now - 4000, updatedAt: now - 3000 }
]
let createCalls = 0
const listeners = new Set()
window.location.hash = '#stickies'
window.crew = {
  listStickies: async () => stickies,
  createSticky: async input => {
    createCalls += 1
    const made = { id: 'made-' + createCalls, color: 'default', pinned: false, createdAt: now, updatedAt: now, ...input }
    stickies = [made, ...stickies]
    listeners.forEach(listener => listener(stickies))
    return made
  },
  updateSticky: async (id, patch) => {
    stickies = stickies.map(one => one.id === id ? { ...one, ...patch, updatedAt: now } : one)
    listeners.forEach(listener => listener(stickies))
    return stickies.find(one => one.id === id) ?? null
  },
  deleteSticky: async () => true,
  onStickiesChanged: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  openSticky: async () => true,
  openExternal: async () => true,
  onWindowShape: () => {},
  setWindowPinned: async value => value
}
window.stickyCreateCalls = () => createCalls
createRoot(document.getElementById('root')).render(React.createElement(StickiesWindow))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
app.disableHardwareAcceleration()
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const READ = \`(() => {
  const box = element => {
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
  }
  const rows = [...document.querySelectorAll('[data-swipe-action-row]')]
  const current = document.querySelector('button[aria-current="page"]')
  const action = rows[0]?.querySelector('button[aria-label="Delete"]')
  const surface = rows[0]?.querySelector('[data-swipe-surface]')
  const title = document.querySelector('input[aria-label="Sticky title"]')
  const editable = document.querySelector('.doc [contenteditable="true"]')
  return {
    sidebar: box(document.querySelector('[data-sticky-sidebar]')),
    rowBoxes: rows.map(box),
    rowButtonBoxes: rows.map(row => box(row.querySelector('button[aria-current], button:not([aria-label="Delete"])'))),
    currentText: current?.textContent ?? null,
    title: title?.value ?? null,
    titlePlaceholderColor: title ? getComputedStyle(title, '::placeholder').color : null,
    editorFocused: Boolean(editable && (editable === document.activeElement || editable.contains(document.activeElement))),
    createCalls: window.stickyCreateCalls(),
    offset: rows[0]?.dataset.offset ?? null,
    action: box(action),
    actionClip: action ? getComputedStyle(action).clipPath : null,
    surface: box(surface),
    swipeInset: surface ? getComputedStyle(surface).getPropertyValue('--swipe-inset') : null
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1080, height: 780, show: true, backgroundColor: '#141414' })
  const seen = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1400)
    seen.initial = await win.webContents.executeJavaScript(READ)
    const target = await win.webContents.executeJavaScript(\`(() => { const row = [...document.querySelectorAll('button')].find(one => one.textContent?.includes('Body first note')); const rect = row.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } })()\`)
    win.webContents.sendInputEvent({ type: 'mouseDown', x: target.x, y: target.y, button: 'left', clickCount: 1 })
    win.webContents.sendInputEvent({ type: 'mouseUp', x: target.x, y: target.y, button: 'left', clickCount: 1 })
    await wait(200)
    seen.clicked = await win.webContents.executeJavaScript(READ)
    await win.webContents.executeJavaScript(\`(() => { const row = document.querySelector('[data-swipe-action-row]'); row.dispatchEvent(new WheelEvent('wheel', { deltaX: 56, deltaY: 0, bubbles: true, cancelable: true })) })()\`)
    await wait(180)
    seen.swiped = await win.webContents.executeJavaScript(READ)
    const [width, height] = win.getContentSize()
    fs.writeFileSync(${JSON.stringify(shot)}, (await win.webContents.capturePage({ x: 0, y: 0, width, height })).toPNG())
  } catch (error) {
    seen.failed = String(error && error.stack)
  }
  console.log('SEEN ' + JSON.stringify(seen))
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-stickies-look-')))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>')
  await writeFile(path.join(dir, 'probe.tsx'), probeSource())
  await writeFile(path.join(dir, 'probe.css'), `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`)
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

const dir = await stage()
try {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({ root: dir, base: './', logLevel: 'silent', plugins: [tailwind()], build: { outDir: path.join(dir, 'dist'), emptyOutDir: true } })
  const seen = await new Promise((accept, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.on('exit', () => {
      const line = out.split('\n').find(row => row.startsWith('SEEN '))
      if (line) accept(JSON.parse(line.slice(5)))
      else reject(new Error('the window said nothing back'))
    })
    child.on('error', reject)
  })
  console.log(JSON.stringify({ ...seen, shot }, null, 2))
} finally {
  await rm(dir, { recursive: true, force: true })
}
