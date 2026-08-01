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

const VERDICT = 'typing-check:'
const LINE = 'the composer has to stay quick with the whole thread standing behind it'
const SHORT = 6
const LONG = 400
const PASSES = 3
const OLD = process.env.CREW_TYPING_OLD === '1'

const OLD_HOOK = `import { useLayoutEffect, useRef } from 'react'

export function useAutoResize(value: string, maxHeight = 200) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = \`\${next}px\`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeight])

  return ref
}
`

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import ThreadView from ${from('views/ThreadView.tsx')}
import { useBrowser } from ${from('state/browser.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

const THREAD = 'thread-1'
const PROMPT = 'prompt-1'
const ASK = '@Claude replace the canvas'

const AGENT = {
  id: 'ali/claude',
  label: 'Claude',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const DIFF = [
  '@@ -1,6 +1,7 @@',
  ' import { useRef } from "react"',
  '-const wide = 200',
  '+const wide = 240',
  '+const tall = 120',
  ' export function box() {',
  '   return wide',
  ' }'
].join('\\n')

const DAY = 86400000
const BEGAN = 1753920000000
const at = index => BEGAN + Math.floor(index / 140) * DAY + index * 1000

const stepAt = index => {
  const kind = index % 3
  if (kind === 1) return { id: 'step-' + index, ts: at(index), kind: 'thinking', status: 'done', text: 'Working out what the row at ' + index + ' has to hold, and whether the one before it already said it.' }
  if (kind === 2) return {
    id: 'step-' + index,
    ts: at(index),
    kind: 'tool',
    status: 'done',
    name: 'Edit',
    detail: 'src/renderer/src/components/row-' + index + '.tsx',
    files: [{ path: 'src/renderer/src/components/row-' + index + '.tsx', added: 2, removed: 1, diff: DIFF }]
  }
  return { id: 'step-' + index, ts: at(index), kind: 'tool', status: 'done', name: 'Read', detail: 'step number ' + index }
}

const messageAt = index => ({
  id: 'said-' + index,
  ts: at(index),
  kind: 'message',
  authorId: 'ali',
  authorName: 'ALI',
  text: 'A line somebody wrote partway down the thread, at row ' + index + '. It runs on a while, the way a real one does, so the row is a paragraph rather than a word and the column has something to lay out.',
  threadId: THREAD
})

const seed = rows => {
  const steps = []
  const said = []
  for (let index = 0; index < rows; index++) {
    if (index > 0 && index % 20 === 0) said.push(messageAt(index))
    else steps.push(stepAt(index))
  }
  return {
    connection: 'online',
    place: 'project:here',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [AGENT],
    events: [
      { id: 'started', ts: 1, kind: 'thread.started', threadId: THREAD, agentId: AGENT.id, agentLabel: AGENT.label, title: ASK, byName: 'ALI' },
      { id: 'asked', ts: 2, kind: 'message', authorId: 'ali', authorName: 'ALI', text: ASK, mentions: [AGENT.id], threadId: THREAD },
      { id: 'ran', ts: 3, kind: 'agent.start', threadId: THREAD, promptId: PROMPT, agentId: AGENT.id, agentLabel: AGENT.label, promptText: ASK, byName: 'ALI' },
      ...said
    ],
    threads: {
      [THREAD]: { id: THREAD, agentId: AGENT.id, agentLabel: AGENT.label, title: ASK, createdBy: 'ALI', status: 'open', mode: 'build' }
    },
    openThreadIds: [THREAD],
    openThreadId: THREAD,
    threadPrompts: {},
    threadDrafts: {},
    threadCommands: {},
    queues: {},
    steps: { [PROMPT]: steps },
    tokens: {},
    pending: {}
  }
}

window.crew = {
  warmTerminal: () => undefined,
  onUpdate: () => () => {},
  updateState: async () => ({ stage: 'none' })
}

useBrowser.setState({ open: false })
window.seedThread = rows => useCrew.setState(seed(rows))
window.seedThread(${SHORT})
createRoot(document.getElementById('root')).render(React.createElement(ThreadView, { threadId: THREAD }))
window.typingReady = true
`
}

const driveSource = `(async () => {
  const frame = () => new Promise(done => requestAnimationFrame(done))
  const settle = async (times = 4) => {
    for (let at = 0; at < times; at++) await frame()
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  const composer = () => document.querySelector('textarea[placeholder="Send a message or @ someone"]')
  const scroller = () => document.querySelector('.overflow-y-auto')

  const summarise = samples => {
    const sorted = [...samples].sort((a, b) => a - b)
    const total = sorted.reduce((sum, value) => sum + value, 0)
    return {
      mean: Number((total / sorted.length).toFixed(3)),
      median: Number(sorted[Math.floor(sorted.length / 2)].toFixed(3)),
      p95: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(3)),
      worst: Number(sorted[sorted.length - 1].toFixed(3))
    }
  }

  const typeLine = async () => {
    const el = composer()
    const flat = []
    const grew = []
    const framed = []
    setter.call(el, '')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    let held = el.clientHeight
    for (let at = 1; at <= ${JSON.stringify(LINE)}.length; at++) {
      const value = ${JSON.stringify(LINE)}.slice(0, at)
      const start = performance.now()
      setter.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      const dispatched = performance.now()
      await frame()
      const painted = performance.now()
      const now = el.clientHeight
      ;(now === held ? flat : grew).push(dispatched - start)
      framed.push(painted - start)
      held = now
    }
    setter.call(el, '')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    return { flat, grew, framed }
  }

  const reflow = reads => {
    const el = composer()
    el.style.height = 'auto'
    const full = el.scrollHeight
    el.style.height = Math.min(full, 200) + 'px'
    if (reads > 1) void el.scrollHeight
  }

  const forced = reads => {
    const held = composer().style.height
    const began = performance.now()
    for (let at = 0; at < 400; at++) reflow(reads)
    const ended = performance.now()
    composer().style.height = held
    return Number(((ended - began) / 400).toFixed(4))
  }

  const measure = async (rows, contained) => {
    window.seedThread(rows)
    await settle(8)
    const box = scroller()
    box.style.contain = contained ? 'layout' : ''
    await settle(4)
    const flat = []
    const grew = []
    const framed = []
    for (let pass = 0; pass < ${PASSES}; pass++) {
      const run = await typeLine()
      flat.push(...run.flat)
      grew.push(...run.grew)
      framed.push(...run.framed)
    }
    return {
      rows,
      contained,
      drawn: box.querySelectorAll('.space-y-5 > *').length,
      tall: box.scrollHeight,
      keystrokes: flat.length + grew.length,
      lines: grew.length / ${PASSES},
      sync: summarise(flat),
      growing: grew.length > 0 ? summarise(grew) : null,
      frame: summarise(framed),
      once: forced(1),
      twice: forced(2)
    }
  }

  if (!composer()) return { failed: 'the composer never drew' }
  if (!scroller()) return { failed: 'the thread scroller never drew' }
  await measure(${LONG}, false)

  const results = []
  results.push(await measure(${SHORT}, false))
  results.push(await measure(${LONG}, false))
  results.push(await measure(${LONG}, true))

  const box = scroller()
  box.style.contain = 'layout'
  await settle(4)
  const rowsBefore = document.querySelectorAll('.overflow-y-auto *').length
  const divider = document.querySelector('.overflow-y-auto .sticky')
  const layers = {
    dividerDrawn: Boolean(divider) && divider.getBoundingClientRect().height > 0,
    dividerSticky: Boolean(divider) && getComputedStyle(divider).position === 'sticky',
    scrollerZ: getComputedStyle(box).zIndex,
    rows: rowsBefore
  }
  box.style.contain = ''

  return { results, layers, height: composer().getBoundingClientRect().height }
})()`

const mainSource = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const errors = []
  const win = new BrowserWindow({ width: 1280, height: 900, show: true, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(String(message).slice(0, 300))
  })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  for (let at = 0; at < 200; at++) {
    const ready = await win.webContents.executeJavaScript('Boolean(window.typingReady)').catch(() => false)
    if (ready) break
    await wait(50)
  }
  await wait(1200)
  let result = null
  try {
    result = await win.webContents.executeJavaScript(${JSON.stringify(driveSource)})
  } catch (error) {
    result = { failed: String((error && error.message) || error) }
  }
  console.log('TYPING ' + JSON.stringify({ ...result, errors: [...new Set(errors)].slice(0, 8) }))
  app.exit(0)
}).catch(error => {
  console.log('TYPING ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-typing-')))
  await writeFile(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body><div id="root"></div></body></html>'
  )
  await writeFile(path.join(dir, 'probe.tsx'), probeSource())
  await writeFile(path.join(dir, 'useAutoResize.ts'), OLD_HOOK)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`
  )
  await writeFile(path.join(dir, 'main.cjs'), mainSource)
  return dir
}

async function compile(dir) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  const swap = OLD
    ? [{ find: path.join(root, 'src/renderer/src/components/useAutoResize'), replacement: path.join(dir, 'useAutoResize.ts') }]
    : []
  await build({
    root: dir,
    base: './',
    logLevel: 'silent',
    plugins: [tailwind()],
    resolve: { alias: swap },
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
  })
  return dir
}

function run(dir) {
  return new Promise((settle, fail) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], {
      env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      fail(new Error('the window never finished typing'))
    }, 300_000)
    child.on('exit', () => {
      clearTimeout(timer)
      const line = out.split('\n').find(text => text.startsWith('TYPING '))
      if (!line) return fail(new Error('the window said nothing back'))
      settle(JSON.parse(line.slice(7)))
    })
    child.on('error', fail)
  })
}

const say = result => {
  const what = result.contained ? `${result.rows} rows, contained` : `${result.rows} rows`
  console.log(`  ${what.padEnd(22)} ${result.drawn} rows drawn, ${result.tall}px of thread`)
  console.log(`  ${''.padEnd(22)} keystroke mean ${result.sync.mean}ms  median ${result.sync.median}ms  p95 ${result.sync.p95}ms  worst ${result.sync.worst}ms`)
  console.log(`  ${''.padEnd(22)} to frame  mean ${result.frame.mean}ms  median ${result.frame.median}ms  p95 ${result.frame.p95}ms`)
  console.log(`  ${''.padEnd(22)} the reflow itself, one read ${result.once.median}ms, two reads ${result.twice.median}ms`)
}

let bad = false
const dir = await stage()
try {
  const seen = await run(await compile(dir))
  if (seen.failed) throw new Error(seen.failed)
  const [short, long, contained] = seen.results
  console.log(`${OLD ? 'the hook as it was, reading twice' : 'the hook as it is, reading once'}, ${LINE.length} characters typed ${PASSES} times over`)
  say(short)
  say(long)
  say(contained)

  const cost = Number((long.sync.median - short.sync.median).toFixed(3))
  const left = Number((contained.sync.median - short.sync.median).toFixed(3))
  console.log(`\n  the rows cost ${cost}ms a keystroke, and ${left}ms of that is left with the scroller contained`)
  console.log(`  the day divider ${seen.layers.dividerDrawn ? 'draws' : 'does not draw'} inside a contained scroller and is still ${seen.layers.dividerSticky ? 'sticky' : 'not sticky'}`)
  for (const error of seen.errors ?? []) console.log(`  window error: ${error}`)

  if (long.keystrokes < LINE.length) {
    console.error(`only ${long.keystrokes} keystrokes were typed`)
    bad = true
  }
  if (long.rows !== LONG) {
    console.error('the long thread was never seeded')
    bad = true
  }
  if (cost > 1) {
    console.error(`a thread of ${LONG} rows costs ${cost}ms a keystroke, which is a composer that drags as a thread grows`)
    bad = true
  }
  if (long.sync.p95 > 4) {
    console.error(`a keystroke reached ${long.sync.p95}ms at the 95th`)
    bad = true
  }
} catch (error) {
  console.error(`the check fell over: ${error.message}`)
  bad = true
} finally {
  await rm(dir, { recursive: true, force: true })
}

console.log(`${VERDICT} ${bad ? 'failed' : 'passed'}`)
if (bad) process.exitCode = 1
