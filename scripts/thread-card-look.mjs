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
const shots = root

const HEIGHT = 1000
const CASES = [
  ['900', 900],
  ['1280', 1280],
  ['700', 700]
]

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import Chat from ${from('views/Chat.tsx')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

try {
  globalThis.localStorage.setItem('crew.prefs', JSON.stringify({ tokens: true, cost: true }))
} catch (e) {}

window.crew = {
  warmTerminal: () => {},
  onUpdate: () => () => {},
  updateState: async () => ({ stage: 'none' }),
  notify: async () => {},
  copy: async () => {}
}

const NOW = Date.now()
const ago = seconds => NOW - seconds * 1000

const agent = (id, label, ownerId, ownerName) => ({
  id,
  label,
  provider: 'claude',
  ownerId,
  ownerName,
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
})

const AGENTS = [
  agent('ali/bubbles', 'Bubbles', 'ali', 'ALI'),
  agent('sam/codex', 'Codex', 'sam', 'SAM'),
  agent('ali/kimi', 'Kimi', 'ali', 'ALI'),
  agent('sam/gemini', 'Gemini', 'sam', 'SAM'),
  agent('ali/opus', 'Opus', 'ali', 'ALI')
]

const PLAN = [
  '## What moves',
  '',
  'The toolbox writes a tool on the card a schedule is written on, so the two stop being one form in two shapes.',
  '',
  '1. Lift the kinds table out of the panel and hand it to ToolDoes',
  '2. Raise the card from state/toolBuilder and mount it once in App',
  '3. Leave the mark a control on the card, since a tool is the face its tile wears'
].join('\\n')

const THREADS = {
  'thread-working': {
    id: 'thread-working',
    agentId: 'ali/bubbles',
    agentLabel: 'Bubbles',
    title: '@Bubbles redraw the thread card so a run says what it is doing at a glance',
    createdBy: 'ALI',
    status: 'open',
    mode: 'build'
  },
  'thread-thinking': {
    id: 'thread-thinking',
    agentId: 'sam/codex',
    agentLabel: 'Codex',
    title: '@Codex work out why a sync pass takes seven minutes on a busy folder',
    createdBy: 'SAM',
    status: 'open',
    mode: 'build'
  },
  'thread-ready': {
    id: 'thread-ready',
    agentId: 'ali/kimi',
    agentLabel: 'Kimi',
    title: '@Kimi put the docs list on the app row so the lit row stops reading as rail',
    createdBy: 'ALI',
    status: 'open',
    mode: 'build'
  },
  'thread-failed': {
    id: 'thread-failed',
    agentId: 'sam/gemini',
    agentLabel: 'Gemini',
    title: '@Gemini run the review panel suite and fix whatever fails',
    createdBy: 'SAM',
    status: 'open',
    mode: 'build'
  },
  'thread-plan': {
    id: 'thread-plan',
    agentId: 'ali/opus',
    agentLabel: 'Opus',
    title: '@Opus plan the move of the toolbox builder onto the schedule card',
    createdBy: 'ALI',
    status: 'open',
    mode: 'plan',
    plan: PLAN
  }
}

const EVENTS = [
  {
    id: 'e-1',
    ts: ago(1900),
    kind: 'thread.started',
    threadId: 'thread-working',
    agentId: 'ali/bubbles',
    agentLabel: 'Bubbles',
    title: THREADS['thread-working'].title,
    byName: 'ALI'
  },
  {
    id: 'e-2',
    ts: ago(1700),
    kind: 'message',
    authorId: 'sam',
    authorName: 'SAM',
    text: 'Left the band at 52 for now. If it grows the whole feed grows with it, so worth a look before it lands.',
    mentions: []
  },
  {
    id: 'e-3',
    ts: ago(1500),
    kind: 'thread.started',
    threadId: 'thread-thinking',
    agentId: 'sam/codex',
    agentLabel: 'Codex',
    title: THREADS['thread-thinking'].title,
    byName: 'SAM'
  },
  {
    id: 'e-4',
    ts: ago(1200),
    kind: 'thread.started',
    threadId: 'thread-ready',
    agentId: 'ali/kimi',
    agentLabel: 'Kimi',
    title: THREADS['thread-ready'].title,
    byName: 'ALI'
  },
  {
    id: 'e-5',
    ts: ago(900),
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: 'Reading that one now.',
    mentions: []
  },
  {
    id: 'e-6',
    ts: ago(700),
    kind: 'thread.started',
    threadId: 'thread-failed',
    agentId: 'sam/gemini',
    agentLabel: 'Gemini',
    title: THREADS['thread-failed'].title,
    byName: 'SAM'
  },
  {
    id: 'e-7',
    ts: ago(400),
    kind: 'thread.started',
    threadId: 'thread-plan',
    agentId: 'ali/opus',
    agentLabel: 'Opus',
    title: THREADS['thread-plan'].title,
    byName: 'ALI',
    mode: 'plan'
  },
  {
    id: 'e-8',
    ts: ago(196),
    kind: 'agent.start',
    threadId: 'thread-working',
    promptId: 'prompt-working',
    agentId: 'ali/bubbles',
    agentLabel: 'Bubbles',
    promptText: 'redraw the thread card',
    byName: 'ALI'
  },
  {
    id: 'e-9',
    ts: ago(97),
    kind: 'agent.start',
    threadId: 'thread-thinking',
    promptId: 'prompt-thinking',
    agentId: 'sam/codex',
    agentLabel: 'Codex',
    promptText: 'work out why a sync pass is slow',
    byName: 'SAM'
  },
  {
    id: 'e-10',
    ts: ago(1190),
    kind: 'agent.start',
    threadId: 'thread-ready',
    promptId: 'prompt-ready',
    agentId: 'ali/kimi',
    agentLabel: 'Kimi',
    promptText: 'put the docs list on the app row',
    byName: 'ALI'
  },
  {
    id: 'e-11',
    ts: ago(1010),
    kind: 'agent.end',
    threadId: 'thread-ready',
    promptId: 'prompt-ready',
    agentId: 'ali/kimi',
    agentLabel: 'Kimi',
    ok: true,
    text: 'The list rows wear NavRow now, lit at bg-fg/[0.08] with the chevron and the add beside them. The rail surface is off the page, so nothing in the column reads as a piece of rail any more.',
    ms: 181000,
    tokens: 96400,
    cost: 0.74
  },
  {
    id: 'e-12',
    ts: ago(690),
    kind: 'agent.start',
    threadId: 'thread-failed',
    promptId: 'prompt-failed',
    agentId: 'sam/gemini',
    agentLabel: 'Gemini',
    promptText: 'run the review panel suite',
    byName: 'SAM'
  },
  {
    id: 'e-13',
    ts: ago(560),
    kind: 'agent.end',
    threadId: 'thread-failed',
    promptId: 'prompt-failed',
    agentId: 'sam/gemini',
    agentLabel: 'Gemini',
    ok: false,
    error: 'gemini exited 1: the CLI could not reach the model, and the run stopped before the first tool call',
    ms: 13000
  }
]

const FILES = [
  {
    path: 'src/renderer/src/components/ThreadStatusBar.tsx',
    added: 96,
    removed: 31,
    diff: '@@ -20,7 +20,9 @@\\n-    <div className="bg-ink-700 px-5 h-[52px]">\\n+    <div className="bg-ink-700 px-5 py-3">\\n+      <span className="text-sm text-fg-muted">{label}</span>\\n'
  },
  {
    path: 'src/renderer/src/components/ThreadCard.tsx',
    added: 54,
    removed: 11,
    diff: '@@ -44,6 +44,8 @@\\n-        <ThreadStatusBar thread={thread} label={label} />\\n+        <ThreadStatusBar thread={thread} label={label} files={files} />\\n'
  },
  {
    path: 'src/renderer/src/components/feed/feedItems.ts',
    added: 30,
    removed: 4,
    diff: '@@ -12,4 +12,6 @@\\n export interface ThreadStatus {\\n   state: ThreadState\\n   detail: string\\n+  files?: FileChange[]\\n }\\n'
  }
]

const STEPS = {
  'prompt-working': [
    {
      id: 'step-w1',
      ts: ago(190),
      kind: 'text',
      status: 'done',
      text: 'Reading the card and the band it holds before touching either.'
    },
    {
      id: 'step-w2',
      ts: ago(170),
      kind: 'tool',
      status: 'done',
      name: 'Edit',
      detail: 'src/renderer/src/components/ThreadStatusBar.tsx',
      files: [FILES[0]]
    },
    {
      id: 'step-w3',
      ts: ago(140),
      kind: 'tool',
      status: 'done',
      name: 'Edit',
      detail: 'src/renderer/src/components/ThreadCard.tsx',
      files: [FILES[1]]
    },
    {
      id: 'step-w4',
      ts: ago(100),
      kind: 'tool',
      status: 'done',
      name: 'Edit',
      detail: 'src/renderer/src/components/feed/feedItems.ts',
      files: [FILES[2]]
    },
    {
      id: 'step-w5',
      ts: ago(64),
      kind: 'tool',
      status: 'running',
      name: 'Read',
      detail: 'src/renderer/src/components/FeedCard.tsx'
    }
  ],
  'prompt-thinking': [
    {
      id: 'step-t1',
      ts: ago(90),
      kind: 'tool',
      status: 'done',
      name: 'Bash',
      detail: 'git log --oneline -20 -- .crew'
    },
    {
      id: 'step-t2',
      ts: ago(120),
      kind: 'thinking',
      status: 'running',
      text: 'The pass rewrites the whole chat log on every commit, so the cost is the size of the file rather than the size of what changed. That would explain why a quiet afternoon is as slow as a busy one. Worth checking whether the segments are being sealed at all before I go looking at the push itself.'
    }
  ],
  'prompt-ready': [
    {
      id: 'step-r1',
      ts: ago(1180),
      kind: 'tool',
      status: 'done',
      name: 'Edit',
      detail: 'src/renderer/src/components/docs/DocsList.tsx',
      files: [
        {
          path: 'src/renderer/src/components/docs/DocsList.tsx',
          added: 62,
          removed: 24,
          diff: '@@ -8,5 +8,6 @@\\n-      <div className="bg-ink-800 rounded-xl">\\n+      <NavRow lit={page === open} className="rounded-xl">\\n'
        }
      ]
    },
    {
      id: 'step-r2',
      ts: ago(1080),
      kind: 'tool',
      status: 'done',
      name: 'Bash',
      detail: 'yarn test tests/docs-layout.test.ts',
      output: 'Test Files  1 passed (1)\\n     Tests  9 passed (9)'
    }
  ]
}

useCrew.setState({
  connection: 'online',
  place: 'project:here',
  folder: '/Users/ali/Documents/Repositories/crew',
  code: 'look',
  httpBase: '',
  selfId: 'ali',
  selfName: 'ALI',
  members: [
    { id: 'ali', name: 'ALI', connected: true },
    { id: 'sam', name: 'SAM', connected: true }
  ],
  agents: AGENTS,
  events: EVENTS,
  eventLimit: 500,
  moreHistory: false,
  loadingHistory: false,
  threads: THREADS,
  threadPrompts: { 'thread-working': 'prompt-working', 'thread-thinking': 'prompt-thinking' },
  threadDrafts: {},
  threadCommands: {},
  chatDraft: '',
  chatCommands: [],
  queues: {},
  steps: STEPS,
  tokens: { 'prompt-working': 42000, 'prompt-thinking': 18600, 'prompt-ready': 96400 },
  costs: { 'prompt-working': 0.31, 'prompt-thinking': 0.12, 'prompt-ready': 0.74 },
  activePrompts: { 'ali/bubbles': ['prompt-working'], 'sam/codex': ['prompt-thinking'] },
  readEvents: [],
  readSteps: {},
  openThreadIds: [],
  openThreadId: null,
  typists: [],
  todos: [],
  tickets: [],
  tools: [],
  memories: [],
  plugins: [],
  schedules: [],
  emoji: [],
  scores: [],
  boards: [],
  docs: {},
  pending: {},
  attachmentMb: 10
})

function Page() {
  return React.createElement('div', { className: 'h-full bg-ink-900' }, React.createElement(Chat))
}

window.addEventListener('error', event => console.error('STACK ' + (event.error && event.error.stack)))

createRoot(document.getElementById('root')).render(React.createElement(Page))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const SHOTS = ${JSON.stringify(shots)}
const CASES = ${JSON.stringify(CASES)}
const HEIGHT = ${HEIGHT}

const SCROLL = where => \`(() => {
  const el = document.querySelector('div.overflow-y-auto')
  if (!el) return false
  el.scrollTop = \${JSON.stringify(where)} === 'top' ? 0 : el.scrollHeight
  return true
})()\`

const READ = \`(() => {
  const scroller = document.querySelector('div.overflow-y-auto')
  const feed = scroller || document
  const cards = [...feed.querySelectorAll('[role=button]')]
  const NAMES = ['working tool', 'working thinking', 'ready', 'failed', 'plan']
  const wordsOf = band =>
    [...band.querySelectorAll('*')]
      .filter(el => el.children.length === 0 && (el.textContent || '').trim().length > 0)
      .map(el => {
        const style = getComputedStyle(el)
        return {
          text: (el.textContent || '').replace(/\\\\s+/g, ' ').trim().slice(0, 78),
          size: style.fontSize,
          color: style.color,
          weight: style.fontWeight
        }
      })
  return cards.map((card, index) => {
    const box = card.getBoundingClientRect()
    const band = card.lastElementChild
    return {
      name: NAMES[index] || 'card ' + index,
      width: Math.round(box.width),
      height: Math.round(box.height),
      band: band ? Math.round(band.getBoundingClientRect().height) : null,
      words: band ? wordsOf(band) : null
    }
  })
})()\`

async function shoot(win, name) {
  const image = await win.capturePage()
  fs.writeFileSync(path.join(SHOTS, 'thread-card-look-' + name + '.png'), image.toPNG())
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: CASES[0][1], height: HEIGHT, show: true, backgroundColor: '#141414' })
  const said = { reads: {} }
  const trail = []
  said.trail = trail
  const step = async (name, run) => { trail.push(name); return run() }
  win.webContents.on('console-message', (e, level, message) => { if (level > 1) trail.push('console: ' + message) })
  try {
    await step('load', () => win.loadFile(path.join(__dirname, 'dist/index.html')))
    await wait(1200)
    for (const [name, width] of CASES) {
      await step('size ' + name, async () => {
        win.setContentSize(width, HEIGHT)
        await wait(500)
      })
      await step('top ' + name, () => win.webContents.executeJavaScript(SCROLL('top')))
      await wait(400)
      await shoot(win, name)
      said.reads[name] = await step('read ' + name, () => win.webContents.executeJavaScript(READ))
      await step('tail ' + name, () => win.webContents.executeJavaScript(SCROLL('tail')))
      await wait(400)
      await shoot(win, name + '-tail')
    }
  } catch (e) {
    said.failed = trail.join(' | ') + ' >> ' + String(e && e.message)
  }
  console.log('SEEN ' + JSON.stringify(said))
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-thread-card-look-')))
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

const pad = (text, width) => String(text).padEnd(width)
const say = (word, one) =>
  one ? `${pad(word, 16)}${pad(one.size, 7)}${pad(one.color, 22)}${one.text}` : `${pad(word, 16)}nothing found`

const dir = await stage()
await compile(dir)
const seen = await run(dir)
if (seen.failed) throw new Error(seen.failed)
console.log(JSON.stringify(seen.trail, null, 1))

for (const [name] of CASES) {
  const cards = seen.reads[name] ?? []
  console.log(`\nat ${name} across, ${cards.length} cards`)
  for (const want of ['working tool', 'ready']) {
    const card = cards.find(one => one.name === want)
    if (!card) {
      console.log(`${pad(want, 16)}nothing found`)
      continue
    }
    const words = card.words ?? []
    console.log(`${pad(want, 16)}card ${card.width} x ${card.height}, band ${card.band} high`)
    console.log(say('  label', words[0]))
    console.log(say('  subject', words[1]))
  }
}

console.log(`\nshots written beside the project as thread-card-look-*.png`)
