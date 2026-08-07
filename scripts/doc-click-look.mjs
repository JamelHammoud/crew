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

const TEXT = [
  '# Welcome',
  '',
  'A short line.',
  '',
  '- one for headings and lists',
  '- two to pick emoji',
  '  - a level in',
  '',
  '- [ ] a thing to do',
  '',
  '1. first',
  '',
  '> a quote to read',
  '',
  '- a bullet long enough that it wraps onto a second line in the writing column, which is what makes the end of a line a different place from the end of the block',
  ''
].join('\n')

const DOCS = { ideas: { title: 'Ideas', text: TEXT } }

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

function Page() {
  React.useEffect(() => {
    useDocs.getState().open('ideas')
  }, [])
  return React.createElement(
    'div',
    { className: 'h-full relative isolate bg-ink-900' },
    React.createElement('main', { className: 'absolute inset-0' }, React.createElement(Docs))
  )
}

createRoot(document.getElementById('root')).render(React.createElement(Page))
`
}

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))

const ROWS = \`(() => {
  return [...document.querySelectorAll('.bn-block-content')].map(row => {
    const box = row.getBoundingClientRect()
    const ink = row.querySelector(':scope > .bn-inline-content')
    return {
      kind: row.getAttribute('data-content-type'),
      says: (row.textContent || '').trim().slice(0, 26) || '(empty)',
      tall: Math.round(box.height),
      slack: ink ? Math.round(box.right - ink.getBoundingClientRect().right) : null,
      y: Math.round(box.top + 14),
      x: Math.round(box.right - 6)
    }
  })
})()\`

const CARET = \`(() => {
  const sel = window.getSelection()
  if (!sel || !sel.anchorNode) return null
  const node = sel.anchorNode
  const text = node.nodeType === 3 ? node.data : (node.textContent || '')
  return { at: sel.anchorOffset, of: text.length }
})()\`

const HINT = \`(() => {
  const empty = document.querySelector('.bn-block-content:has(.ProseMirror-trailingBreak:only-child)')
  if (!empty) return null
  const box = empty.getBoundingClientRect()
  return {
    says: getComputedStyle(empty, '::after').content.slice(0, 32),
    kidWide: Math.round(empty.firstElementChild.getBoundingClientRect().width),
    rowWide: Math.round(box.width)
  }
})()\`

const ALIGN = \`(() => {
  const row = document.querySelector('.bn-block-content[data-content-type="paragraph"]')
  if (!row) return null
  const out = {}
  for (const how of ['left', 'center', 'right']) {
    row.setAttribute('data-text-alignment', how)
    const box = row.getBoundingClientRect()
    const span = row.querySelector('.bn-inline-content')
    const seek = document.createRange()
    seek.selectNodeContents(span)
    out[how] = {
      wordLeft: Math.round(seek.getBoundingClientRect().left - box.left),
      rowWide: Math.round(box.width)
    }
  }
  row.removeAttribute('data-text-alignment')
  return out
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1800)

    const first = await win.webContents.executeJavaScript(ROWS)
    const line = first.find(r => r.kind === 'paragraph')
    win.webContents.sendInputEvent({ type: 'mouseDown', x: line.x, y: line.y, button: 'left', clickCount: 1 })
    win.webContents.sendInputEvent({ type: 'mouseUp', x: line.x, y: line.y, button: 'left', clickCount: 1 })
    await wait(150)
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
    win.webContents.sendInputEvent({ type: 'char', keyCode: '\\r' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
    await wait(350)

    const align = await win.webContents.executeJavaScript(ALIGN)
    const rows = await win.webContents.executeJavaScript(ROWS)
    const seen = []
    let hint = null
    for (const row of rows) {
      if (row.kind === 'codeBlock') continue
      win.webContents.sendInputEvent({ type: 'mouseDown', x: row.x, y: row.y, button: 'left', clickCount: 1 })
      win.webContents.sendInputEvent({ type: 'mouseUp', x: row.x, y: row.y, button: 'left', clickCount: 1 })
      await wait(90)
      seen.push({ ...row, caret: await win.webContents.executeJavaScript(CARET) })
      if (row.says === '(empty)') hint = await win.webContents.executeJavaScript(HINT)
    }
    console.log('SEEN ' + JSON.stringify({ seen, hint, align }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-doc-click-')))
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
const wrong = []
try {
  await compile(dir)
  const { failed, seen, hint, align } = await run(dir)
  if (failed) throw new Error(failed)

  console.log('Clicking past the end of a row\n')
  seen.forEach(read => {
    const { at, of } = read.caret ?? { at: -1, of: -1 }
    const wrapped = read.tall > 40
    const landed = at === of ? 'the end' : at === 0 && of > 0 ? 'the START' : `${at} of ${of}`
    if (at !== of && !wrapped) wrong.push(`${read.kind} "${read.says}" landed at ${at} of ${of}`)
    console.log(`  ${read.kind.padEnd(17)} ${String(read.slack).padStart(4)} slack  ->  ${landed}`)
  })

  console.log('\nThe placeholder on an empty block')
  if (hint) {
    console.log(`  ${hint.says} beside a box ${hint.kidWide} of ${hint.rowWide}`)
    if (hint.kidWide > 40) wrong.push(`the placeholder was pushed ${hint.kidWide} in`)
  } else console.log('  nothing showing')

  console.log('\nAlignment')
  Object.entries(align).forEach(([how, a]) => console.log(`  ${how.padEnd(6)} words start ${a.wordLeft} of ${a.rowWide}`))
  if (align.center.wordLeft < 10) wrong.push('centred text did not move off the left')
  if (align.right.wordLeft <= align.center.wordLeft) wrong.push('right aligned text did not stand right of centred')

  console.log(wrong.length ? `\nWRONG\n  ${wrong.join('\n  ')}` : '\nEvery row lands at the end of what is written in it.')
} finally {
  await rm(dir, { recursive: true, force: true })
}
