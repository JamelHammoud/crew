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

const LIST = [
  '1. One, the first level',
  '   1. Two, a level in',
  '   2. Two again',
  '      1. Three, two levels in',
  '         1. Four, where it starts over',
  '            1. Five',
  '               1. Six',
  '2. Back out at the top',
  '3. And a third',
  ''
].join('\n')

const DOCS = { ideas: { title: 'Ideas', text: LIST } }

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

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-number-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const OUT = ${JSON.stringify(path.join(shots, 'numbers'))}

const READ = \`(() => {
  const depthOf = el => {
    let at = el.parentElement
    let deep = 0
    while (at) {
      if (at.classList.contains('bn-block-group')) deep += 1
      if (at.classList.contains('bn-editor')) break
      at = at.parentElement
    }
    return deep
  }
  const rows = [...document.querySelectorAll('.bn-block-content[data-content-type="numberedListItem"]')]
  if (!rows.length) return { failed: 'no numbered rows on the page' }
  const ROMAN = [[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']]
  const roman = n => ROMAN.reduce((out, [v, s]) => { while (n >= v) { out += s; n -= v } return out }, '')
  const alpha = n => { let out = ''; while (n > 0) { n -= 1; out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26) } return out }
  const spell = { decimal: String, 'lower-alpha': alpha, 'lower-roman': roman }
  return rows.map(row => {
    const mark = getComputedStyle(row, '::before')
    const style = (/counter\\(doc-order,?\\s*([a-z-]*)\\)/.exec(mark.content) || [])[1] || 'decimal'
    const counted = Number((/doc-order\\s+(-?\\d+)/.exec(getComputedStyle(row).counterReset) || [])[1])
    return {
      depth: depthOf(row),
      says: (row.textContent || '').trim().slice(0, 28),
      index: Number(row.dataset.index || 0),
      counted: Number.isFinite(counted) ? counted : 'never read',
      style,
      paints: spell[style] ? spell[style](counted) + '.' : 'a style nothing here spells',
      ink: mark.color,
      gutter: Math.round(parseFloat(mark.width) * 100) / 100
    }
  })
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(2600)
    const seen = await win.webContents.executeJavaScript(READ)
    const shot = await win.webContents.capturePage()
    await writeFile(OUT + '.png', shot.toPNG())
    console.log('SEEN ' + JSON.stringify(seen))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-number-look-')))
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
  seen.forEach(read => {
    console.log(`\nlevel ${read.depth}  ${read.says}`)
    console.log(`  index ${read.index}, asked for ${read.asks}`)
    console.log(`  painted ${read.paints} in ${read.ink}`)
    console.log(`  marker ${read.gutter} across`)
  })
  console.log(`\nwrote the shot to ${shots}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
