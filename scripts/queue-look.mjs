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
const shots = path.join(tmpdir(), 'crew-queue-look')

function source() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return String.raw`import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import QueueBar from ${from('components/QueueBar.tsx')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

useCrew.setState({ httpBase: 'http://127.0.0.1:2739' })
window.moves = []

const items = [
  {
    promptId: 'one',
    author: 'Jamel',
    self: true,
    sendable: true,
    text: 'Tighten the queue layout and keep the full message available.\n\nThis second paragraph is deliberately long enough to prove that the preview keeps every line without taking room away from the queue itself.',
    agentLabel: 'Bubbles'
  },
  {
    promptId: 'two',
    author: 'Ali',
    self: false,
    sendable: false,
    text: 'Check the interaction in the real window after the layout settles.'
  },
  {
    promptId: 'three',
    author: 'Jamel',
    self: true,
    sendable: true,
    text: 'Run the focused queue tests and the production build.'
  }
]

function Page() {
  return React.createElement(
    'div',
    { className: 'h-full bg-ink-900 flex items-end justify-center p-12' },
    React.createElement('div', { className: 'w-[660px]' }, React.createElement(QueueBar, {
      items,
      onEdit: id => window.actions.push(['edit', id]),
      onRemove: id => window.actions.push(['remove', id]),
      onSend: id => window.actions.push(['send', id]),
      onMove: (id, to) => window.moves.push([id, to])
    }))
  )
}

window.actions = []
createRoot(document.getElementById('root')).render(React.createElement(Page))
`
}

const main = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const shots = ${JSON.stringify(shots)}

async function shoot(win, name) {
  const image = await win.capturePage()
  fs.writeFileSync(path.join(shots, name + '.png'), image.toPNG())
}

app.whenReady().then(async () => {
  fs.mkdirSync(shots, { recursive: true })
  const win = new BrowserWindow({ width: 760, height: 620, show: true, backgroundColor: '#141414' })
  const seen = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(600)
    await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(button => button.textContent.includes('messages queued')).click()")
    await wait(200)
    await shoot(win, 'queue')
    const first = await win.webContents.executeJavaScript("(() => { const r = document.querySelector('[data-reorder=one]').getBoundingClientRect(); return { x: r.left + 140, y: r.top + r.height / 2 } })()")
    win.webContents.sendInputEvent({ type: 'mouseMove', x: first.x, y: first.y })
    await wait(450)
    seen.preview = await win.webContents.executeJavaScript("document.querySelectorAll('.glass.fixed').length")
    await shoot(win, 'preview')
    win.webContents.sendInputEvent({ type: 'mouseDown', x: first.x, y: first.y, button: 'left', clickCount: 1 })
    win.webContents.sendInputEvent({ type: 'mouseMove', x: first.x, y: first.y + 120, button: 'left' })
    await wait(120)
    seen.drag = await win.webContents.executeJavaScript("({ cards: document.querySelectorAll('.glass.fixed').length, line: document.querySelector('[data-reorder-line]')?.style.opacity, hand: Boolean(document.querySelector('[data-reorder-hand]')) })")
    await shoot(win, 'drag')
    win.webContents.sendInputEvent({ type: 'mouseUp', x: first.x, y: first.y + 120, button: 'left', clickCount: 1 })
    await wait(150)
    seen.moves = await win.webContents.executeJavaScript('window.moves')
    await win.webContents.executeJavaScript("document.querySelector('[aria-label=\"More for queued message\"]').click()")
    await wait(200)
    seen.menu = await win.webContents.executeJavaScript("[...document.querySelectorAll('.glass.fixed button')].map(button => button.textContent.trim())")
    await shoot(win, 'menu')
  } catch (error) {
    seen.failed = String(error && error.stack)
  }
  console.log('SEEN ' + JSON.stringify(seen))
  app.exit(0)
})`

async function stage() {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-queue-look-')))
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>'
  )
  await writeFile(path.join(directory, 'probe.tsx'), source())
  await writeFile(
    path.join(directory, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`
  )
  await writeFile(path.join(directory, 'main.cjs'), main)
  return directory
}

async function compile(directory) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: directory,
    base: './',
    logLevel: 'silent',
    plugins: [tailwind()],
    build: { outDir: path.join(directory, 'dist'), emptyOutDir: true }
  })
}

function run(directory) {
  return new Promise((accept, reject) => {
    const child = spawn(electron, [path.join(directory, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.on('exit', () => {
      const line = output.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error('the window said nothing back'))
      accept(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const directory = await stage()
await compile(directory)
const seen = await run(directory)
if (seen.failed) throw new Error(seen.failed)
if (seen.preview !== 1) throw new Error(`the preview count was ${seen.preview}`)
if (seen.drag.cards !== 0 || seen.drag.line !== '1' || !seen.drag.hand)
  throw new Error(`the drag was ${JSON.stringify(seen.drag)}`)
if (JSON.stringify(seen.moves) !== JSON.stringify([['one', 2]]))
  throw new Error(`the move was ${JSON.stringify(seen.moves)}`)
if (JSON.stringify(seen.menu) !== JSON.stringify(['Edit in composer', 'Send now', 'Remove from queue']))
  throw new Error(`the menu was ${JSON.stringify(seen.menu)}`)
console.log(`preview open      ${seen.preview === 1 ? 'yes' : 'no'}`)
console.log(`preview on drag   ${seen.drag.cards === 0 ? 'no' : 'yes'}`)
console.log(`drop indicator    ${seen.drag.line === '1' && seen.drag.hand ? 'yes' : 'no'}`)
console.log(`move              ${seen.moves[0][0]} to ${seen.moves[0][1]}`)
console.log(`actions           ${seen.menu.join(', ')}`)
console.log(`pictures in ${shots}`)
