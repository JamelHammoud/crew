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
const HEIGHT = 980

const TABLE = [
  '# Releases',
  '',
  'What is going out, and who is holding it.',
  '',
  '| Release | Owner | Status | Notes |',
  '| --- | --- | --- | --- |',
  '| 0.1.0 | Jamel | Shipped | The first one anybody outside saw |',
  '| 0.2.0 | Ali | In review | Waiting on the signing certificate |',
  '| 0.3.0 | Bubbles | Drafting | Tables, docs, and the rest of the writing |',
  '',
  'A line after it, so the room underneath can be read.',
  ''
].join('\n')

const DOCS = { releases: { title: 'Releases', text: TABLE } }

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
    useDocs.getState().open('releases')
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

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-table-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const OUT = ${JSON.stringify(path.join(shots, 'tables'))}
const THEMES = ['dark', 'light']

const HOVER = where => \`(() => {
  const table = document.querySelector('.bn-editor [data-content-type="table"] table')
  const wrap = document.querySelector('.bn-editor [data-content-type="table"] .tableWrapper')
  if (!table) return false
  const rows = [...table.rows]
  const where = \` + JSON.stringify(where) + \`
  const cell =
    where === 'last row' ? rows[rows.length - 1].cells[0]
    : where === 'last column' ? rows[1].cells[rows[0].cells.length - 1]
    : rows[1].cells[0]
  const box = cell.getBoundingClientRect()
  const edge = table.getBoundingClientRect()
  const at =
    where === 'under the table'
      ? { clientX: edge.left + edge.width / 2, clientY: edge.bottom + 8 }
      : where === 'right of the table'
        ? { clientX: edge.right + 8, clientY: edge.top + edge.height / 2 }
        : { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }
  const on = where === 'under the table' || where === 'right of the table' ? wrap : cell
  const send = { ...at, bubbles: true }
  on.dispatchEvent(new MouseEvent('mouseover', send))
  on.dispatchEvent(new MouseEvent('mousemove', send))
  return true
})()\`

const READ = \`(() => {
  const round = n => Math.round(n * 100) / 100
  const box = el => {
    const r = el.getBoundingClientRect()
    return { x: round(r.left), y: round(r.top), w: round(r.width), h: round(r.height) }
  }
  const wrap = document.querySelector('.bn-editor [data-content-type="table"] .tableWrapper')
  if (!wrap) return { failed: 'no table on the page' }
  const table = wrap.querySelector('table')
  const head = table.querySelector('th')
  const cell = table.querySelector('td')
  const headStyle = getComputedStyle(head)
  const cellStyle = getComputedStyle(cell)
  const wrapStyle = getComputedStyle(wrap)
  const seen = name => {
    const el = document.querySelector(name)
    if (!el) return null
    const style = getComputedStyle(el)
    return {
      box: box(el),
      paint: style.backgroundColor,
      radius: style.borderTopLeftRadius,
      shows: style.opacity,
      border: style.borderTopWidth + ' ' + style.borderTopColor,
      inWrapper: !!el.closest('.tableWrapper'),
      stands: el.parentElement ? el.parentElement.className || el.parentElement.tagName : '?'
    }
  }
  const rows = [...table.rows].map(row => round(row.getBoundingClientRect().height))
  return {
    wrap: {
      box: box(wrap),
      pad: wrapStyle.padding,
      overflowX: wrapStyle.overflowX,
      overflowY: wrapStyle.overflowY,
      border: wrapStyle.borderTopWidth + ' ' + wrapStyle.borderTopColor,
      radius: wrapStyle.borderTopLeftRadius,
      margin: wrapStyle.marginBlockStart + ' / ' + wrapStyle.marginBlockEnd,
      scrollW: round(wrap.scrollWidth),
      clientW: round(wrap.clientWidth)
    },
    table: { box: box(table), layout: getComputedStyle(table).tableLayout, rows },
    head: {
      box: box(head),
      pad: headStyle.padding,
      paint: headStyle.backgroundColor,
      ink: headStyle.color,
      weight: headStyle.fontWeight,
      size: headStyle.fontSize,
      line: headStyle.lineHeight,
      border: headStyle.borderBottomWidth + ' ' + headStyle.borderBottomColor
    },
    cell: {
      box: box(cell),
      pad: cellStyle.padding,
      paint: cellStyle.backgroundColor,
      ink: cellStyle.color,
      size: cellStyle.fontSize,
      line: cellStyle.lineHeight,
      border: cellStyle.borderRightWidth + ' ' + cellStyle.borderRightColor
    },
    chrome: {
      rowHandle: seen('.bn-table-handle'),
      cellHandle: seen('.bn-table-cell-handle'),
      extendCols: seen('.bn-extend-button-add-remove-columns'),
      extendRows: seen('.bn-extend-button-add-remove-rows'),
      anyExtend: seen('.bn-extend-button'),
      resize: seen('.column-resize-handle')
    },
    floating: [...document.querySelectorAll('[class*="bn-table"], [class*="bn-extend"], .column-resize-handle')]
      .filter(el => el.getBoundingClientRect().width || el.getBoundingClientRect().height)
      .map(el => ({
        what: (el.className || '').split(' ').filter(name => name.startsWith('bn-') || name.startsWith('column-')).join(' '),
        box: box(el),
        inWrapper: !!el.closest('.tableWrapper')
      }))
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1800)
    const out = {}
    for (const theme of THEMES) {
      await win.webContents.executeJavaScript(
        'document.documentElement.classList.toggle("light", ' + JSON.stringify(theme === 'light') + '), true'
      )
      await wait(400)
      await win.webContents.executeJavaScript(HOVER)
      await wait(500)
      out[theme] = await win.webContents.executeJavaScript(READ)
      const shot = await win.webContents.capturePage()
      await writeFile(OUT + '-' + theme + '.png', shot.toPNG())
    }
    console.log('SEEN ' + JSON.stringify(out))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-table-look-')))
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
  for (const [theme, read] of Object.entries(seen)) {
    if (read.failed) throw new Error(read.failed)
    console.log(`\n${theme}`)
    console.log(
      `  wrapper ${read.wrap.box.w} across, pad ${read.wrap.pad}, radius ${read.wrap.radius}, border ${read.wrap.border}`
    )
    console.log(
      `          overflow ${read.wrap.overflowX} / ${read.wrap.overflowY}, scrolls ${read.wrap.scrollW} in ${read.wrap.clientW}, margin ${read.wrap.margin}`
    )
    console.log(`  table ${read.table.box.w} across, layout ${read.table.layout}, rows ${read.table.rows.join(', ')}`)
    console.log(
      `  head ${read.head.box.h} tall, pad ${read.head.pad}, ${read.head.size}/${read.head.line} weight ${read.head.weight}`
    )
    console.log(`       paint ${read.head.paint}, ink ${read.head.ink}, rule ${read.head.border}`)
    console.log(`  cell ${read.cell.box.h} tall, pad ${read.cell.pad}, ${read.cell.size}/${read.cell.line}`)
    console.log(`       paint ${read.cell.paint}, ink ${read.cell.ink}, rule ${read.cell.border}`)
    for (const [what, chrome] of Object.entries(read.chrome))
      console.log(
        `  ${what}: ${chrome ? `${chrome.box.w}x${chrome.box.h} at ${chrome.box.x},${chrome.box.y}, paint ${chrome.paint}, radius ${chrome.radius}, in the wrapper ${chrome.inWrapper}` : 'not there'}`
      )
    for (const one of read.floating)
      console.log(`  standing: ${one.what} ${one.box.w}x${one.box.h} at ${one.box.x},${one.box.y}, in the wrapper ${one.inWrapper}`)
  }
  console.log(`\nwrote the shots to ${shots}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
