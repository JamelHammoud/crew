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

const WIDTH = 900
const HEIGHT = 760

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import AddMenu from ${from('components/AddMenu.tsx')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

const agent = (id, label) => ({
  id,
  label,
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
})

useCrew.setState({
  connection: 'online',
  selfId: 'ali',
  selfName: 'ALI',
  agents: [agent('ali/bubbles', 'Bubbles'), agent('ali/kimi', 'Kimi'), agent('ali/codex', 'Codex Gpt-5.6-sol')],
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  pending: {},
  attachmentMb: 10
})

function Page() {
  return React.createElement(
    'div',
    { className: 'h-full bg-ink-900 flex items-end p-6' },
    React.createElement(
      'div',
      { className: 'w-full rounded-shell bg-ink-800 border border-ink-700 p-5' },
      React.createElement('div', { className: 'h-10 text-sm text-fg-faint' }, 'Ask Crew'),
      React.createElement(
        'div',
        { className: 'flex items-center gap-2' },
        React.createElement(AddMenu, { attachmentKey: 'chat', defaultAgent: true, onSend: () => {} })
      )
    )
  )
}

createRoot(document.getElementById('root')).render(React.createElement(Page))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))

const PRESS = name => \`(() => {
  const el = [...document.querySelectorAll('button')].find(b => ((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')).includes(\${JSON.stringify(name)}))
  if (!el) return false
  el.click()
  return true
})()\`

const BOX = \`(() => {
  const card = document.querySelector('.glass.fixed')
  if (!card) return null
  const r = card.getBoundingClientRect()
  const inner = card.firstElementChild
  return {
    left: Math.round(r.left),
    right: Math.round(r.right),
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    width: Math.round(r.width),
    height: Math.round(r.height),
    box: inner ? getComputedStyle(inner).transitionProperty : null,
    radius: getComputedStyle(card).borderTopLeftRadius
  }
})()\`

const WATCH = name => \`new Promise(done => {
  const card = document.querySelector('.glass.fixed')
  const seen = []
  const el = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(\${JSON.stringify(name)}))
  el.click()
  let frames = 0
  const tick = () => {
    const now = document.querySelector('.glass.fixed').getBoundingClientRect()
    seen.push({ w: Math.round(now.width), h: Math.round(now.height), bottom: Math.round(now.bottom), left: Math.round(now.left) })
    frames += 1
    if (frames < 26) requestAnimationFrame(tick)
    else done(seen)
  }
  requestAnimationFrame(tick)
})\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  const said = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    await win.webContents.executeJavaScript(PRESS('Add to your message'))
    await wait(400)
    said.menu = await win.webContents.executeJavaScript(BOX)
    said.frames = await win.webContents.executeJavaScript(WATCH('Default agent'))
    await wait(300)
    said.agents = await win.webContents.executeJavaScript(BOX)
    said.rows = await win.webContents.executeJavaScript(\`[...document.querySelectorAll('.glass.fixed button')].map(b => b.textContent)\`)
    await win.webContents.executeJavaScript(\`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })), true\`)
    await wait(300)
    await win.webContents.executeJavaScript(PRESS('Add to your message'))
    await wait(400)
    said.gifFrames = await win.webContents.executeJavaScript(WATCH('Pick a GIF'))
    await wait(300)
    said.gif = await win.webContents.executeJavaScript(BOX)
  } catch (e) {
    said.failed = String(e && e.stack)
  }
  console.log('SEEN ' + JSON.stringify(said))
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-plus-look-')))
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

console.log(`\nthe rows        ${seen.menu.width} x ${seen.menu.height}, bottom at ${seen.menu.bottom}, left at ${seen.menu.left}`)
console.log(`the faces       ${seen.agents.width} x ${seen.agents.height}, bottom at ${seen.agents.bottom}, left at ${seen.agents.left}`)
console.log(`what moves      ${seen.agents.box}`)
console.log(`corner          ${seen.agents.radius}`)
console.log(`rows in it      ${JSON.stringify(seen.rows)}`)

console.log(`the GIFs        ${seen.gif.width} x ${seen.gif.height}, bottom at ${seen.gif.bottom}, left at ${seen.gif.left}`)

function movement(say, frames) {
  const bottoms = new Set(frames.map(f => f.bottom))
  const lefts = new Set(frames.map(f => f.left))
  const widths = frames.map(f => f.w)
  const heights = frames.map(f => f.h)
  console.log(`\n${say}, frame by frame`)
  console.log(`  width   ${widths.join(' ')}`)
  console.log(`  height  ${heights.join(' ')}`)
  console.log(`  bottom edge held: ${bottoms.size === 1 ? `yes, at ${[...bottoms][0]}` : `NO, it moved through ${[...bottoms].join(' ')}`}`)
  console.log(`  left edge held: ${lefts.size === 1 ? `yes, at ${[...lefts][0]}` : `NO, it moved through ${[...lefts].join(' ')}`}`)
  const steps = new Set(widths.concat(heights)).size
  console.log(`  ${steps > 4 ? `it travels, ${steps} sizes on the way` : 'IT CUTS, nothing between the two'}`)
}

movement('to the faces', seen.frames)
movement('to the GIFs', seen.gifFrames)
