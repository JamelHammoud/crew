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
const shots = path.join(root, 'shots')

const WIDTH = 720
const HEIGHT = 820

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import ScheduleCard from ${from('components/scheduled/ScheduleCard.tsx')}
import ToolBuilder from ${from('components/ToolBuilder.tsx')}
import { buildTool } from ${from('state/toolBuilder.ts')}
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
  agents: [agent('ali/bubbles', 'Bubbles'), agent('ali/kimi', 'Kimi')],
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  docs: { notes: { title: 'Notes', text: '' }, journal: { title: 'Journal', text: '' } },
  boards: [{ id: 'b1', name: 'Onboarding' }],
  tools: [
    { id: 't1', name: 'Figma', mark: 'globe', action: { kind: 'web', url: 'figma.com' }, createdBy: 'ALI', ts: 1 },
    { id: 't2', name: 'Dev', mark: 'terminal', action: { kind: 'terminal', command: 'yarn dev' }, createdBy: 'ALI', ts: 2 }
  ],
  addSchedule: () => null,
  editSchedule: () => null,
  addTool: () => {},
  editTool: () => {},
  removeTool: () => {}
})

window.buildTool = buildTool

function Page() {
  const which = new URLSearchParams(location.search).get('card')
  return React.createElement(
    'div',
    { className: 'h-full bg-ink-900' },
    which === 'tool'
      ? React.createElement(ToolBuilder)
      : React.createElement(ScheduleCard, { open: true, schedule: null, onClose: () => {} })
  )
}

createRoot(document.getElementById('root')).render(React.createElement(Page))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const SHOTS = ${JSON.stringify(shots)}

const PRESS = name => \`(() => {
  const want = \${JSON.stringify(name)}
  const el = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').trim() === want || (b.textContent || '').trim() === want)
  if (!el) return false
  el.click()
  return true
})()\`

const WRITE = (label, text) => \`(() => {
  const el = document.querySelector('[aria-label=' + JSON.stringify(\${JSON.stringify(label)}) + ']')
  if (!el) return false
  const setter = Object.getOwnPropertyDescriptor(el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(el, \${JSON.stringify(text)})
  el.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()\`

const BOX = label => \`(() => {
  const el = document.querySelector('[aria-label=' + JSON.stringify(\${JSON.stringify(label)}) + ']')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { height: Math.round(r.height), scrolls: getComputedStyle(el).overflowY, room: el.scrollHeight }
})()\`

const CARD = \`(() => {
  const el = document.querySelector('[role=dialog]')
  const r = el.getBoundingClientRect()
  return { width: Math.round(r.width), height: Math.round(r.height) }
})()\`

async function shoot(win, name) {
  const image = await win.capturePage()
  fs.writeFileSync(path.join(SHOTS, name + '.png'), image.toPNG())
}

app.whenReady().then(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  const said = {}
  const trail = []
  said.trail = trail
  const step = async (name, run) => { trail.push(name); return run() }
  win.webContents.on('console-message', (e, level, message) => { if (level > 1) trail.push('console: ' + message) })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'), { search: '?card=schedule' })
    await wait(900)
    await shoot(win, 'schedule-empty')
    said.schedule = await win.webContents.executeJavaScript(CARD)
    said.short = await step('box empty', () => win.webContents.executeJavaScript(BOX('What to ask')))
    await step('write', () => win.webContents.executeJavaScript(WRITE('What to ask', 'Summarize what was added to the codebase today in features release notes style, and say who did what.')))
    await wait(200)
    said.grown = await win.webContents.executeJavaScript(BOX('What to ask'))
    await shoot(win, 'schedule-grown')
    await win.webContents.executeJavaScript(WRITE('What to ask', Array.from({ length: 14 }, (u, i) => 'A line of what to ask number ' + (i + 1)).join('\\n')))
    await wait(200)
    said.capped = await win.webContents.executeJavaScript(BOX('What to ask'))
    await shoot(win, 'schedule-capped')

    await win.loadFile(path.join(__dirname, 'dist/index.html'), { search: '?card=tool' })
    await wait(700)
    await win.webContents.executeJavaScript('window.buildTool(null), true')
    await wait(400)
    said.tool = await win.webContents.executeJavaScript(CARD)
    await shoot(win, 'tool-new')
    await win.webContents.executeJavaScript(PRESS('What it does'))
    await wait(300)
    await shoot(win, 'tool-kinds')
    await win.webContents.executeJavaScript(\`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent||'').trim() === 'Start a thread'); if (!b) return false; b.click(); return true })()\`)
    await wait(300)
    await win.webContents.executeJavaScript(WRITE('Name', 'Nightly tests'))
    await win.webContents.executeJavaScript(WRITE('What to ask', 'Run the whole suite and fix whatever fails, then say what you changed.'))
    await wait(200)
    await shoot(win, 'tool-prompt')
    await win.webContents.executeJavaScript(PRESS('Choose a mark'))
    await wait(300)
    await shoot(win, 'tool-mark')
  } catch (e) {
    said.failed = trail.join(' | ') + ' >> ' + String(e && e.message)
  }
  console.log('SEEN ' + JSON.stringify(said))
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-card-look-')))
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

console.log(`\nschedule card   ${seen.schedule.width} x ${seen.schedule.height}`)
console.log(`tool card       ${seen.tool.width} x ${seen.tool.height}`)
console.log(`words empty     ${seen.short.height} high, ${seen.short.scrolls}`)
console.log(`words grown     ${seen.grown.height} high, ${seen.grown.scrolls}`)
console.log(`words capped    ${seen.capped.height} high, ${seen.capped.scrolls}, holding ${seen.capped.room}`)
console.log(`\nshots in ${shots}`)
