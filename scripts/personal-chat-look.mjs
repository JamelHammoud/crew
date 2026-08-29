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
const shot = path.join(tmpdir(), 'crew-personal-chat-look.png')

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import NewChat from ${from('components/sidebar/NewChat.tsx')}
import PersonalChatWindow from ${from('views/PersonalChatWindow.tsx')}
import { ChatGlyph } from ${from('icons/index.ts')}
import { useCrew } from ${from('state/store.ts')}
import { setFullScreen } from ${from('state/windowShape.ts')}
import './probe.css'

window.crew = { listFiles: async () => [] }
window.setProbeFullScreen = setFullScreen

const now = Date.now()
const alpha = {
  id: 'alpha',
  agentId: 'jamel/fake',
  agentLabel: 'Fake',
  title: 'Plan a quiet weekend',
  createdBy: 'Jamel',
  startedAt: now - 36_000,
  status: 'open',
  mode: 'build'
}
const beta = {
  id: 'beta',
  agentId: 'jamel/fake',
  agentLabel: 'Fake',
  title: 'Compare two cameras',
  createdBy: 'Jamel',
  startedAt: now - 86_400_000,
  status: 'open',
  mode: 'build'
}
const gamma = {
  id: 'gamma',
  agentId: 'jamel/fake',
  agentLabel: 'Fake',
  title: 'Draft a dinner menu',
  createdBy: 'Jamel',
  startedAt: now - 72_000,
  status: 'open',
  mode: 'build'
}
const extra = Object.fromEntries(Array.from({ length: 10 }, (_, index) => {
  const id = 'extra-' + index
  return [id, {
    id,
    agentId: 'jamel/fake',
    agentLabel: 'Fake',
    title: 'Saved conversation ' + (index + 1),
    createdBy: 'Jamel',
    startedAt: now - (index + 3) * 120_000,
    status: 'open',
    mode: 'build'
  }]
}))

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
  events: [
    { id: 'alpha-started', ts: alpha.startedAt, kind: 'thread.started', threadId: alpha.id, agentId: alpha.agentId, agentLabel: alpha.agentLabel, title: alpha.title, byName: 'Jamel' },
    { id: 'beta-started', ts: beta.startedAt, kind: 'thread.started', threadId: beta.id, agentId: beta.agentId, agentLabel: beta.agentLabel, title: beta.title, byName: 'Jamel' },
    { id: 'gamma-started', ts: gamma.startedAt, kind: 'thread.started', threadId: gamma.id, agentId: gamma.agentId, agentLabel: gamma.agentLabel, title: gamma.title, byName: 'Jamel' },
    { id: 'gamma-message', ts: gamma.startedAt + 1000, kind: 'message', threadId: gamma.id, authorId: 'jamel', authorName: 'Jamel', text: 'Something simple for four people.', mentions: [] },
    ...Object.values(extra).map(one => ({ id: one.id + '-started', ts: one.startedAt, kind: 'thread.started', threadId: one.id, agentId: one.agentId, agentLabel: one.agentLabel, title: one.title, byName: 'Jamel' }))
  ],
  threads: { alpha, beta, gamma, ...extra },
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
const fs = require('node:fs')
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
  const chatRow = document.querySelector('[data-chat-row]')
  const composer = document.querySelector('textarea[placeholder="Message"]')
  const history = document.querySelector('[data-personal-history]')
  const historyScroll = document.querySelector('[data-personal-history-scroll]')
  const content = document.querySelector('[data-personal-chat-content]')
  const title = document.querySelector('[data-personal-chat-header] h1')
  const topFade = document.querySelector('[data-scroll-fade="top"]')
  const current = document.querySelector('button[aria-current="page"]')
  const group = current?.closest('section')?.querySelector('[data-personal-history-group]')
  const collapse = named('Hide chat list')
  const dragRegion = document.querySelector('[data-personal-chat-drag-region]')
  return {
    plus: box(plus),
    chatRow: box(chatRow),
    plusOpacity: plus ? getComputedStyle(plus).opacity : null,
    composer: box(composer),
    composerFocused: composer === document.activeElement,
    history: box(history),
    historyScroll: box(historyScroll),
    historyScrollTop: historyScroll?.scrollTop ?? null,
    historyClass: history?.className ?? '',
    content: box(content),
    title: box(title),
    topFadeOpacity: topFade ? getComputedStyle(topFade).opacity : null,
    collapse: box(collapse),
    collapseOpacity: collapse ? getComputedStyle(collapse).opacity : null,
    dragRegion: box(dragRegion),
    dragRegionStyle: dragRegion ? getComputedStyle(dragRegion).getPropertyValue('-webkit-app-region') : null,
    threadHeader: Boolean(named('Mark done') || named('Back to chat')),
    historyText: history?.textContent ?? '',
    current: box(current),
    currentBackground: current ? getComputedStyle(current).backgroundColor : null,
    groupGap: group ? getComputedStyle(group).rowGap : null
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1240, height: 760, show: true, backgroundColor: '#141414' })
  const move = at => win.webContents.sendInputEvent({ type: 'mouseMove', x: at.x, y: at.y })
  const seen = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(800)
    await win.webContents.executeJavaScript(
      \`[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'New chat').click()\`
    )
    await wait(100)
    win.webContents.focus()
    seen.resting = await win.webContents.executeJavaScript(READ)
    const chatRow = seen.resting.chatRow
    move({ x: chatRow.left + 20, y: chatRow.top + chatRow.height / 2 })
    await wait(800)
    seen.hovered = await win.webContents.executeJavaScript(READ)
    const collapse = seen.resting.collapse
    move({
      x: collapse.left + collapse.width / 2,
      y: collapse.top + collapse.height / 2
    })
    await wait(800)
    seen.collapseHovered = await win.webContents.executeJavaScript(READ)
    await win.webContents.executeJavaScript(
      \`[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Hide chat list').click()\`
    )
    seen.collapsing = await win.webContents.executeJavaScript(READ)
    await wait(300)
    seen.collapsed = await win.webContents.executeJavaScript(READ)
    await win.webContents.executeJavaScript(
      \`[...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Show chat list').click()\`
    )
    seen.reopening = await win.webContents.executeJavaScript(READ)
    await wait(300)
    seen.reopened = await win.webContents.executeJavaScript(READ)
    seen.windowed = await win.webContents.executeJavaScript(READ)
    await win.webContents.executeJavaScript('window.setProbeFullScreen(true)')
    await wait(100)
    seen.fullScreen = await win.webContents.executeJavaScript(READ)
    await win.webContents.executeJavaScript('window.setProbeFullScreen(false)')
    await wait(100)
    await win.webContents.executeJavaScript(
      \`[...document.querySelectorAll('button')].find(button => button.textContent?.includes('Draft a dinner menu')).click()\`
    )
    await wait(250)
    const hover = await win.webContents.executeJavaScript(
      \`(() => { const row = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Plan a quiet weekend')); const box = row.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 } })()\`
    )
    move(hover)
    await wait(200)
    seen.active = await win.webContents.executeJavaScript(READ)
    await win.webContents.executeJavaScript(
      \`(() => { const scroll = document.querySelector('[data-personal-history-scroll]'); scroll.scrollTop = 140; scroll.dispatchEvent(new Event('scroll')) })()\`
    )
    await wait(250)
    seen.scrolled = await win.webContents.executeJavaScript(READ)
    const [, height] = win.getContentSize()
    fs.writeFileSync(
      ${JSON.stringify(shot)},
      (await win.webContents.capturePage({ x: 260, y: 0, width: 980, height })).toPNG()
    )
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
    throw new Error('the personal composer did not stand alone with focus: ' + JSON.stringify(seen.resting))
  }
  if (
    !seen.resting.dragRegion ||
    seen.resting.dragRegion.left !== seen.resting.content.left ||
    seen.resting.dragRegion.width !== seen.resting.content.width ||
    seen.resting.dragRegion.top !== 0 ||
    seen.resting.dragRegion.height !== 70 ||
    seen.resting.dragRegionStyle !== 'drag'
  ) {
    throw new Error('the conversation top was not a full drag region: ' + JSON.stringify(seen.resting))
  }
  if (seen.resting.plusOpacity !== '0' || seen.hovered.plusOpacity !== '1')
    throw new Error(
      'the Chat plus did not follow hover: ' +
        JSON.stringify({ resting: seen.resting.plusOpacity, hovered: seen.hovered.plusOpacity, box: seen.resting.plus })
    )
  if (
    !seen.resting.history ||
    !seen.resting.content ||
    !seen.resting.historyClass.includes('sidebar-pinned') ||
    seen.resting.history.width !== 300 ||
    seen.resting.history.left !== 260 ||
    seen.resting.content.left !== 560 ||
    !seen.resting.historyText.includes('Chat') ||
    !seen.resting.historyText.includes('Plan a quiet weekend') ||
    !seen.resting.historyText.includes('Compare two cameras')
  ) {
    throw new Error('personal chat history did not stand beside the conversation: ' + JSON.stringify(seen.resting))
  }
  if (
    seen.resting.collapseOpacity !== '0' ||
    seen.collapseHovered.collapseOpacity !== '1' ||
    seen.collapsed.history.width > 1 ||
    seen.collapsed.content.left !== seen.collapsed.history.left + seen.collapsed.history.width ||
    seen.reopened.history.width !== 300 ||
    seen.reopened.content.left !== 560
  ) {
    throw new Error(
      'personal chat list did not collapse and return: ' +
        JSON.stringify({
          resting: seen.resting,
          hovered: seen.collapseHovered,
          collapsed: seen.collapsed,
          reopened: seen.reopened
        })
    )
  }
  if (
    !seen.active.current ||
    seen.active.groupGap === 'normal' ||
    seen.active.currentBackground === 'rgba(0, 0, 0, 0)'
  ) {
    throw new Error('personal chat active state did not stay separate: ' + JSON.stringify(seen.active))
  }
  if (!seen.windowed.title || !seen.fullScreen.title || seen.fullScreen.title.left >= seen.windowed.title.left) {
    throw new Error(
      'the Chat title did not move into the stoplight space in fullscreen: ' +
        JSON.stringify({ windowed: seen.windowed.title, fullScreen: seen.fullScreen.title })
    )
  }
  if (seen.scrolled.historyScrollTop < 2 || seen.scrolled.topFadeOpacity !== '1') {
    throw new Error('the chat list top fade did not appear after scrolling: ' + JSON.stringify(seen.scrolled))
  }
  console.log(`Chat plus       ${seen.resting.plusOpacity} resting, ${seen.hovered.plusOpacity} hovered`)
  console.log(`Composer        ${seen.resting.composer.width} x ${seen.resting.composer.height}`)
  console.log(`Chat list       ${seen.resting.history.width} x ${seen.resting.history.height}`)
  console.log(`Conversation    ${seen.resting.content.width} x ${seen.resting.content.height}`)
  console.log(`Drag region     ${seen.resting.dragRegion.width} x ${seen.resting.dragRegion.height}`)
  console.log(`Fullscreen Chat ${seen.windowed.title.left} to ${seen.fullScreen.title.left}`)
  console.log(`Top fade        ${seen.scrolled.topFadeOpacity} at ${seen.scrolled.historyScrollTop}px`)
  console.log(`Screenshot      ${shot}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
