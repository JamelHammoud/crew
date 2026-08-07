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

const WIDTH = 1440
const HEIGHT = 900

const DOCS = {
  code: { title: 'Ends on code', text: '# Ends on code\n\n```ts\nconst one = 1\n```\n' },
  words: { title: 'Ends on words', text: '# Ends on words\n\nA paragraph and nothing after it.\n' },
  blank: { title: 'Ends on a blank line', text: '' }
}

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import Docs from ${from('views/Docs.tsx')}
import { useDocs } from ${from('state/docs.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

useCrew.setState({
  docs: ${JSON.stringify(DOCS)},
  selfId: 'self',
  selfName: 'Jamel',
  connection: 'online',
  members: [{ id: 'self', name: 'Jamel', connected: true }]
})

function Look() {
  const [page, setPage] = React.useState('code')
  React.useEffect(() => {
    window.__step = next => setPage(next)
  }, [])
  React.useEffect(() => {
    useDocs.getState().open(page)
  }, [page])
  return React.createElement('div', { className: 'h-full relative isolate bg-ink-900' }, React.createElement(Docs))
}

createRoot(document.getElementById('root')).render(React.createElement(Look))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))

const READ = \`(() => {
  const editor = document.querySelector('.bn-editor')
  const tail = editor.querySelector('.bn-trailing-block')
  const box = el => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
  }
  const blocks = [...editor.querySelectorAll('.bn-block-content')]
  const last = blocks[blocks.length - 1]
  const pad = Math.round(parseFloat(getComputedStyle(editor).paddingBottom))
  const scroller = editor.closest('[class*=overflow]') || document.scrollingElement
  const at = y => {
    const el = document.elementFromPoint(Math.round(window.innerWidth / 2), y)
    const block = el && el.closest('.bn-block-content')
    if (el && el.closest('.bn-trailing-block')) return 'trailing block'
    if (block) return block.getAttribute('data-content-type')
    return el ? el.className || el.tagName : 'nothing'
  }
  const lastBox = box(last)
  return {
    lastKind: last.getAttribute('data-content-type'),
    last: lastBox,
    tail: tail ? box(tail) : null,
    pad,
    room: Math.round(box(editor).bottom - lastBox.bottom),
    hits: [lastBox.bottom + 40, lastBox.bottom + 140, lastBox.bottom + 240].map(y => ({ y, hit: at(y) }))
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  const seen = {}
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1500)
    for (const page of ['code', 'words', 'blank']) {
      await win.webContents.executeJavaScript('window.__step(' + JSON.stringify(page) + ')')
      await wait(600)
      seen[page] = await win.webContents.executeJavaScript(READ)
    }
    console.log('SEEN ' + JSON.stringify(seen))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-doc-tail-')))
  await writeFile(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>'
  )
  await writeFile(path.join(dir, 'probe.tsx'), probeSource())
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n#root { position: relative; }\n`
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
  for (const [page, read] of Object.entries(seen)) {
    console.log(`\n${page}: last block is a ${read.lastKind}, ending at ${read.last.bottom}`)
    console.log(`  room under it: ${read.room}`)
    console.log(`  trailing block: ${read.tail ? `${read.tail.height} tall` : 'none'}`)
    console.log(`  editor padding under it: ${read.pad}`)
    for (const { y, hit } of read.hits) console.log(`  a click ${y - read.last.bottom} below the last block hits the ${hit}`)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}
