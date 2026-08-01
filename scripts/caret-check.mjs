import { spawn } from 'node:child_process'
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

// A caret is the one thing no source test can read. Anything the app paints over
// a character somebody can type beside is paint over the caret drawn against its
// edge, and the sheet is exactly that: an emoji in a doc and in the composer is
// the machine's own glyph with a picture standing on it. Drawn a little larger
// than the character, the picture covered the whole caret and the whole band
// under it, and the box read as one nothing could be typed into. Every suite
// passed. This focuses a real window, puts the caret against a real emoji, and
// counts the pixels it left on the screen.

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
import DocEditor from '${root}/src/renderer/src/components/DocEditor'
import Composer from '${root}/src/renderer/src/components/Composer'

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
`

const MAIN = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 760, height: 520, show: true })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1600)
    const width = await win.webContents.executeJavaScript('innerWidth')
    const drawn = await win.webContents.executeJavaScript('document.querySelectorAll(".doc-emoji").length')
    const seen = []
    for (const where of ['doc', 'composer']) {
      for (const side of ['plain', 'before', 'after']) {
        win.setAlwaysOnTop(true)
        win.show()
        win.focus()
        app.focus({ steal: true })
        win.webContents.focus()
        await wait(400)
        const focused = await win.webContents.executeJavaScript(aim(where, side))
        const at = JSON.parse(await win.webContents.executeJavaScript('JSON.stringify(window.caretAt)'))
        let lit = 0
        for (let frame = 0; frame < 8; frame++) {
          await wait(110)
          const shot = await win.webContents.capturePage()
          lit = Math.max(lit, count(shot.toBitmap(), shot.getSize(), at, width))
        }
        seen.push({ where, side, focused, lit })
      }
    }
    console.log('SEEN ' + JSON.stringify({ drawn, seen }))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.message) }))
  }
  app.exit(0)
})

function aim(where, side) {
  return \`(() => {
    const which = ${JSON.stringify('$WHERE$')}
    return null })()\`.replace(/[\\s\\S]*/, '') || AIM.replace(/__WHERE__/g, where).replace(/__SIDE__/g, side)
}

const AIM = \`(() => {
  const where = '__WHERE__'
  const side = '__SIDE__'
  const host = document.querySelector('[data-say="' + where + '"]')
  const mark = host.querySelector('.doc-emoji, .bn-inline-content') && where === 'doc'
    ? host.querySelector('.doc-emoji')
    : host.querySelector('[data-emoji-box]')
  if (where === 'doc') {
    const line = host.querySelector('.bn-inline-content')
    line.closest('[contenteditable]').focus()
    const range = document.createRange()
    if (side === 'plain') range.setStart(line.firstChild, 1)
    else if (side === 'before') range.setStartBefore(mark)
    else range.setStartAfter(mark)
    range.collapse(true)
    const sel = getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    const box = mark.getBoundingClientRect()
    const spot = side === 'plain' ? range.getBoundingClientRect().x : side === 'before' ? box.x : box.x + box.width
    window.caretAt = { x: spot - 2, y: box.y - 3, w: 5, h: box.height + 6 }
  } else {
    const field = host.querySelector('textarea')
    field.focus()
    const at = side === 'plain' ? 1 : side === 'before' ? 2 : 4
    field.setSelectionRange(at, at)
    const box = mark.getBoundingClientRect()
    const spot = side === 'plain' ? box.x - 8 : side === 'before' ? box.x : box.x + box.width
    window.caretAt = { x: spot - 2, y: box.y - 3, w: 5, h: box.height + 6 }
  }
  return document.hasFocus()
})()\`

function count(bits, size, box, width) {
  const scale = size.width / width
  const x0 = Math.max(0, Math.floor(box.x * scale))
  const y0 = Math.max(0, Math.floor(box.y * scale))
  const x1 = Math.min(size.width, Math.ceil((box.x + box.w) * scale))
  const y1 = Math.min(size.height, Math.ceil((box.y + box.h) * scale))
  let lit = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const at = (y * size.width + x) * 4
      if (bits[at] > 248 && bits[at + 1] > 248 && bits[at + 2] > 248) lit++
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
    if (!read.focused) problems.push(`the window was not focused for ${read.where} ${read.side}, so no caret was ever drawn`)
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
    process.exit(1)
  }
  console.log('the caret stands either side of an emoji in a doc and in the composer')
} finally {
  await rm(dir, { recursive: true, force: true })
}
