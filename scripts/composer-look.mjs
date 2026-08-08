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
const shots = path.join(tmpdir(), 'crew-composer-look')

const WIDTH = 760
const HEIGHT = 520

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import Composer, { COMPOSER_MAX } from ${from('components/Composer.tsx')}
import { useAutoResize } from ${from('components/useAutoResize.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

useCrew.setState({
  connection: 'online',
  selfId: 'ali',
  selfName: 'ALI',
  agents: [],
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  docs: {},
  boards: [],
  pending: {},
  attachmentMb: 10
})

const LINES = [
  'Do a design pass on the thread preview in chat',
  '',
  "It's one of the older things we've worked on, make it look beautiful and match the rest of Crew's UI/UX design",
  '',
  'Ideally you can also see +/- changes (when available) before clicking in',
  '',
  'As well as exactly what is being run right now, if it is working (like literally the last tool call, or "Thinking")'
].join('\\n')

function Page() {
  const [text, setText] = React.useState(LINES)
  const inputRef = useAutoResize(text, COMPOSER_MAX)
  return React.createElement(
    'div',
    { className: 'h-full bg-ink-900 flex items-end justify-center p-6' },
    React.createElement('div', { className: 'w-[660px]' }, React.createElement(Composer, {
      attachmentKey: 'chat',
      value: text,
      placeholder: 'Message the crew',
      inputRef,
      onChange: setText,
      onKeyDown: () => {},
      onSend: () => {},
      defaultAgent: true
    }))
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

const READ = \`(() => { try {
  const card = document.querySelector('.rounded-shell')
  const area = document.querySelector('textarea')
  const ink = document.querySelector('[aria-hidden="true"]')
  const rows = card.lastElementChild
  const top = card.querySelector('.composer-scrim')
  const foot = card.querySelector('.composer-scrim-up')
  const box = el => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), height: Math.round(r.height) } }
  const said = el => { const s = getComputedStyle(el); return { mask: s.maskImage.slice(0, 24), bg: s.backgroundColor, height: s.height } }
  return {
    card: box(card),
    area: box(area),
    rows: box(rows),
    scroll: { top: Math.round(area.scrollTop), height: Math.round(area.scrollHeight), room: getComputedStyle(area).paddingTop + ' / ' + getComputedStyle(area).paddingBottom },
    sync: Math.round(ink.scrollTop),
    clips: getComputedStyle(card).overflow,
    topScrim: top ? { ...box(top), ...said(top) } : null,
    footScrim: foot ? { ...box(foot), ...said(foot) } : null
  }
} catch (e) { return { broke: String(e && e.stack), body: document.body.innerHTML.slice(0, 400) } } })()\`

const SCROLL = at => \`(() => {
  const area = document.querySelector('textarea')
  area.scrollTop = \${at}
  area.dispatchEvent(new Event('scroll', { bubbles: true }))
  return Math.round(area.scrollTop)
})()\`

async function shoot(win, name) {
  const png = await win.webContents.capturePage()
  fs.writeFileSync(path.join(SHOTS, name + '.png'), png.toPNG())
}

app.whenReady().then(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  const said = { console: [] }
  win.webContents.on('console-message', (e, level, message) => said.console.push(message))
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    said.rest = await win.webContents.executeJavaScript(READ)
    await shoot(win, 'composer-rest')
    await win.webContents.executeJavaScript(SCROLL(34))
    await wait(120)
    said.scrolled = await win.webContents.executeJavaScript(READ)
    await shoot(win, 'composer-scrolled')
    await win.webContents.executeJavaScript(SCROLL(9999))
    await wait(120)
    said.foot = await win.webContents.executeJavaScript(READ)
    await shoot(win, 'composer-foot')
  } catch (e) {
    said.failed = String(e && e.stack)
  }
  console.log('SEEN ' + JSON.stringify(said))
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-composer-look-')))
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
if (seen.console?.length) console.log('the window said: ' + seen.console.join('\n'))
if (seen.failed) throw new Error(seen.failed)

function say(name, at) {
  console.log(`\n${name}`)
  console.log(`  card            top ${at.card.top}, bottom ${at.card.bottom}, ${at.card.height} tall, overflow ${at.clips}`)
  console.log(`  the box         top ${at.area.top}, bottom ${at.area.bottom}, ${at.area.height} tall, room ${at.scroll.room}`)
  console.log(`  scrolled        ${at.scroll.top} of ${at.scroll.height}, highlights at ${at.sync}`)
  console.log(`  the controls    top ${at.rows.top}, gap under the box ${at.rows.top - at.area.bottom}`)
  console.log(`  gap over        ${at.area.top - at.card.top}`)
  if (at.topScrim)
    console.log(
      `  scrim top       top ${at.topScrim.top}, ${at.topScrim.height} tall, ${at.topScrim.bg}, mask ${at.topScrim.mask}`
    )
  if (at.footScrim)
    console.log(
      `  scrim foot      bottom ${at.footScrim.bottom}, ${at.footScrim.height} tall, mask ${at.footScrim.mask}`
    )
}

say('at rest', seen.rest)
say('scrolled 60', seen.scrolled)
say('scrolled to the foot', seen.foot)
console.log(`\npictures in ${path.relative(process.cwd(), shots)}`)
