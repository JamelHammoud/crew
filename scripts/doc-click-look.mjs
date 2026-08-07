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

const FILL = '.doc .bn-editor .bn-block-content > .bn-inline-content { flex: 1 1 auto; }'
const KEPT =
  '.doc .bn-editor .bn-block-content:not(:has(.ProseMirror-trailingBreak:only-child)) > .bn-inline-content { flex: 1 1 auto; }'

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
    return {
      kind: row.getAttribute('data-content-type'),
      says: (row.textContent || '').trim().slice(0, 26) || '(empty)',
      tall: Math.round(box.height),
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

const ALIGN = \`(() => {
  const row = document.querySelector('.bn-block-content[data-content-type="paragraph"]')
  if (!row) return null
  const out = {}
  for (const how of ['left', 'center', 'right']) {
    row.setAttribute('data-text-alignment', how)
    const box = row.getBoundingClientRect()
    const ink = row.firstElementChild.getBoundingClientRect()
    const span = row.querySelector('.bn-inline-content')
    let word = null
    if (span) {
      const r = document.createRange()
      r.selectNodeContents(span)
      word = r.getBoundingClientRect()
    }
    out[how] = {
      textAlign: getComputedStyle(row).textAlign,
      inkWide: Math.round(ink.width),
      wordLeft: word ? Math.round(word.left - box.left) : null,
      rowWide: Math.round(box.width)
    }
  }
  row.removeAttribute('data-text-alignment')
  return out
})()\`

const HINT = \`(() => {
  const empty = document.querySelector('.bn-block-content:has(.ProseMirror-trailingBreak:only-child)')
  if (!empty) return null
  const box = empty.getBoundingClientRect()
  const after = getComputedStyle(empty, '::after')
  const kid = empty.firstElementChild.getBoundingClientRect()
  return {
    says: after.content.slice(0, 32),
    kidLeft: Math.round(kid.left - box.left),
    kidWide: Math.round(kid.width),
    rowWide: Math.round(box.width),
    tall: Math.round(box.height)
  }
})()\`

const TRIES = [
  ['as it stands', ''],
  ['every block fills the row', ${JSON.stringify(FILL)}],
  ['every block with something in it fills the row', ${JSON.stringify(KEPT)}]
]

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
    await wait: 0
    await wait(350)

    const all = []
    for (const [name, css] of TRIES) {
      await win.webContents.executeJavaScript(
        '(() => { document.getElementById("try")?.remove();' +
          (css
            ? 'const s=document.createElement("style");s.id="try";s.textContent=' +
              JSON.stringify(css) +
              ';document.head.appendChild(s);'
            : '') +
          'return true })()'
      )
      await wait(200)
      const hint = await win.webContents.executeJavaScript(HINT)
      const align = await win.webContents.executeJavaScript(ALIGN)
      const rows = await win.webContents.executeJavaScript(ROWS)
      const seen = []
      for (const row of rows) {
        if (row.kind === 'codeBlock') continue
        win.webContents.sendInputEvent({ type: 'mouseDown', x: row.x, y: row.y, button: 'left', clickCount: 1 })
        win.webContents.sendInputEvent({ type: 'mouseUp', x: row.x, y: row.y, button: 'left', clickCount: 1 })
        await wait(80)
        seen.push({ ...row, caret: await win.webContents.executeJavaScript(CARET) })
      }
      all.push({ name, seen, hint, align })
    }
    console.log('SEEN ' + JSON.stringify(all))
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
try {
  await compile(dir)
  const all = await run(dir)
  if (all.failed) throw new Error(all.failed)
  all.forEach(({ name, seen, hint, align }) => {
    console.log(`\n== ${name}`)
    seen.forEach(read => {
      const caret = read.caret
      const end = caret && caret.at === caret.of ? 'END  ' : caret && caret.at === 0 ? 'START' : 'mid  '
      const where = caret ? `${caret.at} of ${caret.of}` : 'nowhere'
      console.log(
        `  ${read.kind.padEnd(17)} "${read.says.padEnd(26)}" ${String(read.tall).padStart(3)} tall -> ${end} ${where}`
      )
    })
    console.log(
      '  placeholder ' +
        (hint
          ? `${hint.says} block ${hint.kidWide} of ${hint.rowWide}, starts ${hint.kidLeft} in, ${hint.tall} tall`
          : 'not showing')
    )
    if (align)
      Object.entries(align).forEach(([how, a]) =>
        console.log(
          `  ${how.padEnd(6)} text-align ${a.textAlign.padEnd(6)} box ${String(a.inkWide).padStart(4)} of ${a.rowWide}, words start ${a.wordLeft} in`
        )
      )
  })
} finally {
  await rm(dir, { recursive: true, force: true })
}
