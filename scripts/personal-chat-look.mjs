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

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import NewChat from ${from('components/sidebar/NewChat.tsx')}
import PersonalChatWindow from ${from('views/PersonalChatWindow.tsx')}
import { ChatGlyph } from ${from('icons/index.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

window.crew = { listFiles: async () => [] }

useCrew.setState({
  connection: 'online',
  place: 'personal',
  selfId: 'jamel',
  selfName: 'Jamel',
  agents: [{
    id: 'jamel/fake',
    label: 'Fake',
    provider: 'fake',
    ownerId: 'jamel',
    ownerName: 'Jamel',
    status: 'idle',
    runs: {},
    settings: {},
    fields: []
  }],
  members: [{ id: 'jamel', name: 'Jamel', connected: true }],
  events: [],
  threads: {},
  threadPrompts: {},
  threadDrafts: {},
  threadCommands: {},
  queues: {},
  steps: {},
  tokens: {},
  costs: {},
  activePrompts: {},
  pending: {}
})

function Page() {
  return React.createElement(
    'div',
    { className: 'h-full flex bg-ink-900' },
    React.createElement(
      'aside',
      { className: 'w-[260px] bg-ink-800 border-r border-ink-700 p-3 pt-16' },
      React.createElement(
        'div',
        { className: 'group relative', 'data-chat-row': 'true' },
        React.createElement(
          'div',
          { className: 'w-full rounded-xl py-1.5 pl-2 pr-9 flex items-center gap-2 text-sm font-medium text-fg' },
          React.createElement(ChatGlyph, { className: 'w-[18px] h-[18px] text-fg/70' }),
          React.createElement('span', null, 'Chat')
        ),
        React.createElement(
          'span',
          { className: 'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center' },
          React.createElement(NewChat, { onClick: () => {} })
        )
      )
    ),
    React.createElement('main', { className: 'flex-1 min-w-0 relative' }, React.createElement(PersonalChatWindow))
  )
}

createRoot(document.getElementById('root')).render(React.createElement(Page))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const READ = \`(() => {
  const box = element => {
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
  }
  const named = name => [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === name)
  const plus = named('New personal chat')
  const composer = document.querySelector('textarea[placeholder="Message"]')
  const drawer = document.querySelector('[data-personal-history]')
  return {
    plus: box(plus),
    plusOpacity: plus ? getComputedStyle(plus).opacity : null,
    composer: box(composer),
    composerFocused: composer === document.activeElement,
    history: box(named('Chat history')),
    threadHeader: Boolean(named('Mark done') || named('Back to chat')),
    drawer: box(drawer),
    drawerHidden: drawer?.getAttribute('aria-hidden'),
    drawerTransform: drawer ? getComputedStyle(drawer).transform : null,
    drawerText: drawer?.textContent ?? ''
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 980, height: 760, show: true, backgroundColor: '#141414' })
  const seen = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(800)
    seen.resting = await win.webContents.executeJavaScript(READ)
    const plus = seen.resting.plus
    win.webContents.sendInputEvent({ type: 'mouseMove', x: plus.left + plus.width / 2, y: plus.top + plus.height / 2 })
    await wait(300)
    seen.hovered = await win.webContents.executeJavaScript(READ)
    await win.webContents.executeJavaScript(\`[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Chat history').click()\`)
    await wait(350)
    seen.history = await win.webContents.executeJavaScript(READ)
  } catch (error) {
    seen.failed = String(error && error.stack)
  }
  console.log('SEEN ' + JSON.stringify(seen))
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-personal-chat-look-')))
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
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.resting.composer || seen.resting.threadHeader || !seen.resting.composerFocused) {
    throw new Error('the personal composer did not stand alone with focus')
  }
  if (seen.resting.plusOpacity !== '0' || seen.hovered.plusOpacity !== '1')
    throw new Error('the Chat plus did not follow hover')
  if (
    !seen.history.drawer ||
    seen.resting.drawerHidden !== 'true' ||
    seen.history.drawerHidden !== 'false' ||
    seen.resting.drawerTransform === seen.history.drawerTransform ||
    seen.history.drawer.width !== 380 ||
    !seen.history.drawerText.includes('Chats') ||
    !seen.history.drawerText.includes('No chats yet.')
  ) {
    throw new Error('personal chat history did not open: ' + JSON.stringify(seen.history))
  }
  console.log(`Chat plus       ${seen.resting.plusOpacity} resting, ${seen.hovered.plusOpacity} hovered`)
  console.log(`Composer        ${seen.resting.composer.width} x ${seen.resting.composer.height}`)
  console.log(`History button  ${seen.resting.history.width} x ${seen.resting.history.height}`)
  console.log(`History drawer  ${seen.history.drawer.width} x ${seen.history.drawer.height}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
