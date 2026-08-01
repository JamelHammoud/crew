import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

// A caret is the one thing no source test can read. An emoji in a doc and in the
// composer is the machine's own glyph with a picture of ours standing on it, and
// a picture drawn a little larger than the character it stands on covers the
// caret against its edge and the band under it, so the line reads as one nothing
// can be typed into. Every suite passed the whole time it did. This focuses a
// real window, puts the caret against a real emoji, and counts what it left on
// the screen.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const LIBRARY = ['@blocknote/mantine/style.css']

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><script type="module" src="./probe.js"></script></head>
<body class="bg-ink-900 text-fg font-sans"><div id="root"></div></body></html>`

const APP = `import './probe.css'
import '@blocknote/mantine/style.css'
import { createElement as h, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Composer from '${root}/src/renderer/src/components/Composer'
import DocEditor from '${root}/src/renderer/src/components/DocEditor'

const LINE = 'aa\\u{1F600}bb'

function Probe() {
  const box = useRef(null)
  const [value, setValue] = useState(LINE)
  return h('div', { className: 'p-6 space-y-6' },
    h('div', { 'data-say': 'doc' }, h(DocEditor, { text: LINE, onChange: () => {} })),
    h('div', { 'data-say': 'composer' }, h(Composer, {
      attachmentKey: 'probe',
      value,
      placeholder: 'Say something',
      inputRef: box,
      onChange: setValue,
      onKeyDown: () => {},
      onSend: () => {}
    }))
  )
}

createRoot(document.getElementById('root')).render(h(Probe))

// The caret is put where a person would put it and where it lands is read off
// the picture's own box, since a collapsed range at the edge of an element hands
// back nothing to measure.
window.aimCaret = (where, side) => {
  const host = document.querySelector('[data-say="' + where + '"]')
  const mark = where === 'doc' ? host.querySelector('.doc-emoji') : host.querySelector('.relative.inline-block')
  if (!mark) return { failed: 'nothing in the ' + where + ' is drawing an emoji' }
  const box = mark.getBoundingClientRect()
  let spot = side === 'before' ? box.x : box.x + box.width
  if (where === 'doc') {
    const line = host.querySelector('.bn-inline-content')
    line.closest('[contenteditable]').focus()
    // The caret goes in the text either side of the picture rather than at the
    // element's own edge: a position on the boundary of a node is one the editor
    // normalises somewhere else, and the caret is then nowhere near what is being
    // read.
    const before = mark.previousSibling
    const after = mark.nextSibling
    const range = document.createRange()
    if (side === 'after') range.setStart(after, 0)
    else range.setStart(before, side === 'plain' ? 1 : before.length)
    range.collapse(true)
    const sel = getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    if (side === 'plain') spot = range.getBoundingClientRect().x
  } else {
    const field = host.querySelector('textarea')
    field.focus()
    const at = side === 'plain' ? 1 : side === 'before' ? 2 : 4
    field.setSelectionRange(at, at)
    if (side === 'plain') spot = box.x - 8
  }
  return { focused: document.hasFocus(), at: { x: spot - 2, y: box.y - 3, w: 5, h: box.height + 6 } }
}
`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const SIDES = ['plain', 'before', 'after']

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 760, height: 520, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1600)
    const width = await win.webContents.executeJavaScript('innerWidth')
    const drawn = await win.webContents.executeJavaScript('document.querySelectorAll(".doc-emoji").length')
    const seen = []
    for (const where of ['doc', 'composer']) {
      for (const side of SIDES) {
        win.setAlwaysOnTop(true)
        win.show()
        win.focus()
        app.focus({ steal: true })
        win.webContents.focus()
        await wait(400)
        const aim = JSON.parse(
          await win.webContents.executeJavaScript('JSON.stringify(window.aimCaret(' + JSON.stringify(where) + ',' + JSON.stringify(side) + '))')
        )
        if (aim.failed) throw new Error(aim.failed)
        // A caret is the one thing on the screen that blinks, so what says it is
        // there is the pixels that changed rather than a colour picked in
        // advance. The text either side of it holds still.
        const frames = []
        for (let frame = 0; frame < 10; frame++) {
          await wait(110)
          const shot = await win.webContents.capturePage()
          frames.push({ bits: shot.toBitmap(), size: shot.getSize() })
        }
        let lit = 0
        for (const frame of frames) lit = Math.max(lit, count(frames[0], frame, aim.at, width))
        seen.push({ where, side, focused: aim.focused, lit })
      }
    }
    console.log('SEEN ' + JSON.stringify({ drawn, seen }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})

function count(first, other, box, width) {
  const size = first.size
  if (other.size.width !== size.width || other.size.height !== size.height) return 0
  const scale = size.width / width
  const x0 = Math.max(0, Math.floor(box.x * scale))
  const y0 = Math.max(0, Math.floor(box.y * scale))
  const x1 = Math.min(size.width, Math.ceil((box.x + box.w) * scale))
  const y1 = Math.min(size.height, Math.ceil((box.y + box.h) * scale))
  let lit = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const at = (y * size.width + x) * 4
      const moved =
        Math.abs(first.bits[at] - other.bits[at]) +
        Math.abs(first.bits[at + 1] - other.bits[at + 1]) +
        Math.abs(first.bits[at + 2] - other.bits[at + 2])
      if (moved > 60) lit++
    }
  }
  return lit
}`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-caret-')))
  await writeFile(path.join(dir, 'index.html'), PAGE)
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\n`
  )
  await writeFile(path.join(dir, 'probe.jsx'), APP)
  await writeFile(path.join(dir, 'probe.js'), `import './probe.jsx'\n`)
  await writeFile(path.join(dir, 'main.cjs'), MAIN)
  return dir
}

async function compile(dir) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  const react = (await import('@vitejs/plugin-react')).default
  const resolve = createRequire(path.join(root, 'package.json')).resolve
  await build({
    root: dir,
    base: './',
    logLevel: 'silent',
    plugins: [react(), tailwind()],
    resolve: {
      alias: [
        ...LIBRARY.map(name => ({ find: name, replacement: resolve(name) })),
        { find: 'react-dom', replacement: path.join(root, 'node_modules/react-dom') },
        { find: 'react', replacement: path.join(root, 'node_modules/react') }
      ]
    },
    build: { outDir: path.join(dir, 'dist'), emptyOutDir: true }
  })
  const assets = path.join(dir, 'dist/assets')
  const sheet = (await readdir(assets)).find(name => name.endsWith('.css'))
  if (!sheet) throw new Error('the probe came out with no stylesheet')
  const css = await readFile(path.join(assets, sheet), 'utf8')
  if (!css.includes('doc-emoji')) throw new Error('the stylesheet came out with no rule for the sheet in a doc')
}

function run(dir) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(dir, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', chunk => (out += chunk))
    child.stderr.on('data', () => {})
    child.on('exit', () => {
      const line = out.split('\n').find(row => row.startsWith('SEEN '))
      if (!line) return reject(new Error('the window said nothing back'))
      resolve(JSON.parse(line.slice(5)))
    })
    child.on('error', reject)
  })
}

const dir = await stage()
try {
  await compile(dir)
  const seen = await run(dir)
  if (seen.failed) throw new Error(seen.failed)
  if (!seen.drawn) throw new Error('no emoji was drawn from the sheet, so nothing was really tested')

  const problems = []
  for (const read of seen.seen) {
    if (!read.focused) problems.push(`the window was not focused for the ${read.where}, so no caret was ever drawn`)
  }
  for (const where of ['doc', 'composer']) {
    const plain = seen.seen.find(read => read.where === where && read.side === 'plain')
    if (!plain || plain.lit === 0) {
      problems.push(`no caret was found in the ${where} away from an emoji, so the check could not see one at all`)
      continue
    }
    for (const side of ['before', 'after']) {
      const read = seen.seen.find(one => one.where === where && one.side === side)
      if (!read || read.lit === 0) problems.push(`the caret ${side} an emoji in the ${where} was painted over`)
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(problem)
    for (const read of seen.seen) console.error(`  ${read.where} ${read.side}: ${read.lit}`)
    process.exit(1)
  }
  console.log('the caret stands either side of an emoji in a doc and in the composer')
} finally {
  await rm(dir, { recursive: true, force: true })
}
