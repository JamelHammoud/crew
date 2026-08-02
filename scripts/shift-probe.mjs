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
const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))

const PROBE = `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import MessageReactions from ${from('components/MessageReactions.tsx')}
import { watchShift } from ${from('state/shift.ts')}
import './probe.css'

watchShift()

createRoot(document.getElementById('root')).render(
  React.createElement('div', { className: 'group/message relative p-20', id: 'msg' },
    React.createElement('p', { className: 'text-sm' }, 'a message somebody wrote'),
    React.createElement(MessageReactions, {
      targetId: 'm1',
      reactions: [],
      deletable: true,
      onDelete: () => {},
      onEdit: () => {},
      onReply: () => {}
    })
  )
)
`

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans"><div id="root"></div></body></html>`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(r => setTimeout(r, ms))

const READ = \`(() => {
  const del = document.querySelector('[aria-label="Delete message"]')
  const more = document.querySelector('[aria-label="More"]')
  const tray = more && more.closest('.absolute')
  const box = del && del.getBoundingClientRect()
  return JSON.stringify({
    attr: document.documentElement.hasAttribute('data-shift'),
    found: !!del,
    display: del && getComputedStyle(del).display,
    width: box ? Math.round(box.width) : null,
    trayOpacity: tray && getComputedStyle(tray).opacity
  })
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 700, height: 400, show: true })
  const read = () => win.webContents.executeJavaScript(READ).then(JSON.parse)
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    const rest = await read()
    const spot = await win.webContents.executeJavaScript(\`(() => {
      const r = document.getElementById('msg').getBoundingClientRect()
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) })
    })()\`).then(JSON.parse)
    win.webContents.sendInputEvent({ type: 'mouseMove', x: spot.x, y: spot.y })
    await wait(400)
    const hovered = await read()
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Shift', modifiers: ['shift'] })
    await wait(300)
    const held = await read()
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Shift' })
    await wait(300)
    const letGo = await read()
    // The key never arrives when another window has the keyboard, so the pointer
    // has to carry it on its own.
    win.webContents.sendInputEvent({ type: 'mouseMove', x: spot.x + 3, y: spot.y, modifiers: ['shift'] })
    await wait(300)
    const pointed = await read()
    win.webContents.sendInputEvent({ type: 'mouseMove', x: spot.x + 6, y: spot.y })
    await wait(300)
    const bare = await read()
    console.log('SEEN ' + JSON.stringify({ rest, hovered, held, letGo, pointed, bare }))
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
  await writeFile(path.join(dir, 'probe.js'), PROBE)
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

const dir = await stage()
const { build } = await import('vite')
const tailwind = (await import('@tailwindcss/vite')).default
await build({
  root: dir,
  base: './',
  logLevel: 'silent',
  plugins: [tailwind()],
  build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
})
const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
let out = ''
child.stdout.on('data', d => (out += d))
child.stderr.on('data', d => (out += d))
await new Promise(r => child.on('exit', r))
const line = out.split('\n').find(l => l.startsWith('SEEN '))
console.log(line ? JSON.stringify(JSON.parse(line.slice(5)), null, 2) : 'nothing came back\n' + out)
await rm(dir, { recursive: true, force: true })
