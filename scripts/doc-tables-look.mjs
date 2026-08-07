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
  '',
  '| Machine | Provider | Model | Window | Week | Agents | Threads | Last seen |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  '| Ali (Mac) | Claude | Opus 5 | 42% | 61% | 3 | 12 | Just now |',
  '| Jamel (dev) | Codex | GPT-5.6 | 8% | 22% | 1 | 4 | Two minutes ago |',
  ''
].join('\n')

const DOCS = { releases: { title: 'Releases', text: TABLE } }

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  const shared = file => JSON.stringify(path.join(root, 'src/shared', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import Docs from ${from('views/Docs.tsx')}
import { localizeDoc, relativizeDoc } from ${from('components/images.ts')}
import { useDocs } from ${from('state/docs.ts')}
import { useCrew } from ${from('state/store.ts')}
import {
  applyTableAligns,
  applyTableWidths,
  mendDocTableRows,
  readDocTableAligns,
  readDocTableWidths,
  tableAlignsOf,
  tableWidthsOf,
  writeDocTableAligns,
  writeDocTableWidths
} from ${shared('docTables.ts')}
import './probe.css'

const DOCS = ${JSON.stringify(DOCS)}

function liveEditor() {
  const starts = ['.bn-editor', '.bn-container', '.doc'].map(one => document.querySelector(one)).filter(Boolean)
  for (const start of starts) {
    let node = start
    while (node) {
      for (const key of Object.keys(node)) {
        if (key.indexOf('__reactFiber$') !== 0 && key.indexOf('__reactInternalInstance$') !== 0) continue
        let fiber = node[key]
        while (fiber) {
          const found = fiber.memoizedProps && fiber.memoizedProps.editor
          if (found && typeof found.blocksToMarkdownLossy === 'function' && Array.isArray(found.document)) return found
          fiber = fiber.return
        }
      }
      node = node.parentElement
    }
  }
  return null
}

function widthsIn(blocks) {
  const out = []
  const walk = list => {
    for (const block of list || []) {
      if (block.type === 'table' && block.content)
        out.push((block.content.columnWidths || []).map(width => (width === undefined ? null : width)))
      if (block.children && block.children.length) walk(block.children)
    }
  }
  walk(blocks)
  return out
}

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

const crew = {
  saved: null,
  saves: 0,
  root: null,
  live: () => !!liveEditor(),
  widthsNow() {
    const editor = liveEditor()
    if (!editor) return { failed: 'no editor on the page' }
    return { widths: widthsIn(editor.document) }
  },
  saveNow() {
    const editor = liveEditor()
    if (!editor) return { failed: 'no editor on the page' }
    const base = useCrew.getState().httpBase
    const blocks = editor.document
    const markdown = mendDocTableRows(relativizeDoc(editor.blocksToMarkdownLossy(blocks), base))
    return { markdown: writeDocTableWidths(writeDocTableAligns(markdown, tableAlignsOf(blocks)), tableWidthsOf(blocks)) }
  },
  loadBack(text) {
    const editor = liveEditor()
    if (!editor) return { failed: 'no editor on the page' }
    const base = useCrew.getState().httpBase
    const read = readDocTableWidths(text || '')
    const aligns = readDocTableAligns(read.text)
    const blocks = editor.tryParseMarkdownToBlocks(localizeDoc(read.text, base))
    applyTableWidths(blocks, read.widths)
    applyTableAligns(blocks, aligns)
    return { marks: read.widths, widths: widthsIn(blocks) }
  },
  remount(text) {
    return new Promise(accept => {
      if (crew.root) crew.root.unmount()
      useCrew.setState(state => ({
        docs: { ...state.docs, releases: { title: 'Releases', text } }
      }))
      crew.root = createRoot(document.getElementById('root'))
      crew.root.render(React.createElement(Page))
      setTimeout(() => accept(true), 600)
    })
  }
}

window.__crew = crew

useCrew.setState({
  docs: DOCS,
  selfId: 'self',
  selfName: 'Jamel',
  connection: 'online',
  members: [{ id: 'self', name: 'Jamel', connected: true }],
  updateDoc: (page, text, title) => {
    crew.saved = text
    crew.saves++
    useCrew.setState(state => ({
      docs: { ...state.docs, [page]: { title: title ?? state.docs[page]?.title ?? page, text } }
    }))
  }
})

crew.root = createRoot(document.getElementById('root'))
crew.root.render(React.createElement(Page))
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
const WHERE = ['a cell', 'last row', 'last column', 'under the table', 'right of the table', 'a wide last row']

const HOVER = where => \`(() => {
  const which = \` + JSON.stringify(where.startsWith('a wide') ? 1 : 0) + \`
  const table = document.querySelectorAll('.bn-editor [data-content-type="table"] table')[which]
  const wrap = document.querySelectorAll('.bn-editor [data-content-type="table"] .tableWrapper')[which]
  if (!table) return false
  const rows = [...table.rows]
  const where = \` + JSON.stringify(where) + \`
  const cell =
    where.endsWith('last row') ? rows[rows.length - 1].cells[0]
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
  const wraps = [...document.querySelectorAll('.bn-editor [data-content-type="table"] .tableWrapper')]
  const wrap = wraps[0]
  if (!wrap) return { failed: 'no table on the page' }
  const table = wrap.querySelector('table')
  const wide = wraps[1]
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
      rowHandle: seen('[data-table-handle="row"]'),
      columnHandle: seen('[data-table-handle="column"]'),
      addColumn: seen('.bn-extend-button-add-remove-columns'),
      addRow: seen('.bn-extend-button-add-remove-rows'),
      mantine: seen('.bn-table-handle, .bn-table-cell-handle')
    },
    bar: (() => {
      const at = document.querySelector('[data-table-handle] span')
      if (!at) return null
      const style = getComputedStyle(at)
      return { box: box(at), paint: style.backgroundColor, radius: style.borderTopLeftRadius }
    })(),
    wide: wide
      ? {
          box: box(wide),
          scrollW: round(wide.scrollWidth),
          clientW: round(wide.clientWidth),
          table: round(wide.querySelector('table').getBoundingClientRect().width),
          corner: getComputedStyle(wide.querySelector('tr').firstElementChild).borderTopLeftRadius
        }
      : null
  }
})()\`

const AT = \`(() => {
  const round = n => Math.round(n * 100) / 100
  const table = document.querySelectorAll('.bn-editor [data-content-type="table"] table')[0]
  if (!table) return { failed: 'no table on the page' }
  const row = table.rows[0]
  const cell = row.cells[0]
  const box = cell.getBoundingClientRect()
  return {
    x: box.right - 2,
    y: box.top + box.height / 2,
    tag: cell.tagName,
    columns: row.cells.length,
    cells: [...row.cells].map(one => round(one.getBoundingClientRect().width))
  }
})()\`

const ARMED = \`(() => ({
  handle: !!document.querySelector('.column-resize-handle'),
  cursor: !!document.querySelector('.resize-cursor'),
  editor: !!(window.__crew && window.__crew.live())
}))()\`

const WIDE = \`(() => {
  const round = n => Math.round(n * 100) / 100
  const row = document.querySelectorAll('.bn-editor [data-content-type="table"] table')[0].rows[0]
  return [...row.cells].map(one => round(one.getBoundingClientRect().width))
})()\`

async function dragPass(win, shot) {
  const step = {}
  const at = await win.webContents.executeJavaScript(AT)
  if (at.failed) return { failed: at.failed }
  step.found = at

  const x = Math.round(at.x)
  const y = Math.round(at.y)
  const REACH = 90
  const MOVES = 9

  await win.webContents.executeJavaScript('window.scrollTo(0, 0), true')
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
  await wait(200)
  step.armed = await win.webContents.executeJavaScript(ARMED)
  await shot('drag-armed')

  win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  await wait(80)
  for (let i = 1; i <= MOVES; i++) {
    win.webContents.sendInputEvent({
      type: 'mouseMove',
      x: x + Math.round((REACH * i) / MOVES),
      y,
      button: 'left',
      modifiers: ['leftButtonDown']
    })
    await wait(45)
  }
  step.mid = await win.webContents.executeJavaScript(WIDE)
  await shot('drag-mid')
  win.webContents.sendInputEvent({ type: 'mouseUp', x: x + REACH, y, button: 'left', clickCount: 1 })
  await wait(300)

  step.reach = REACH
  step.after = await win.webContents.executeJavaScript(WIDE)
  step.document = await win.webContents.executeJavaScript('window.__crew.widthsNow()')
  await shot('drag-done')

  step.composed = await win.webContents.executeJavaScript('window.__crew.saveNow()')
  await wait(900)
  step.saved = await win.webContents.executeJavaScript('({ text: window.__crew.saved, saves: window.__crew.saves })')

  const markdown = step.saved.text || (step.composed && step.composed.markdown) || ''
  step.markdown = markdown
  step.back = await win.webContents.executeJavaScript(
    'window.__crew.loadBack(' + JSON.stringify(markdown) + ')'
  )
  await win.webContents.executeJavaScript('window.__crew.remount(' + JSON.stringify(markdown) + ')')
  await wait(700)
  step.remounted = await win.webContents.executeJavaScript('window.__crew.widthsNow()')
  step.remountedWide = await win.webContents.executeJavaScript(WIDE)
  await shot('drag-remounted')
  return step
}

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
      for (const where of WHERE) {
        await win.webContents.executeJavaScript(HOVER(where))
        await wait(400)
        out[theme + ' / ' + where] = await win.webContents.executeJavaScript(READ)
        const shot = await win.webContents.capturePage()
        await writeFile(OUT + '-' + theme + '-' + where.replace(/ /g, '-') + '.png', shot.toPNG())
      }
    }
    console.log('SEEN ' + JSON.stringify(out))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  try {
    await win.webContents.executeJavaScript('document.documentElement.classList.remove("light"), true')
    await wait(400)
    const shot = async name => {
      const png = await win.webContents.capturePage()
      await writeFile(OUT + '-' + name + '.png', png.toPNG())
    }
    console.log('DRAG ' + JSON.stringify(await dragPass(win, shot)))
  } catch (e) {
    console.log('DRAG ' + JSON.stringify({ failed: String(e && e.stack) }))
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
      const rows = out.split('\n')
      const line = rows.find(row => row.startsWith('SEEN '))
      const drag = rows.find(row => row.startsWith('DRAG '))
      if (!line) return reject(new Error('the window said nothing back'))
      accept({ seen: JSON.parse(line.slice(5)), drag: drag ? JSON.parse(drag.slice(5)) : null })
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
    if (!theme.endsWith('a cell')) {
      for (const [what, chrome] of Object.entries(read.chrome))
        if (chrome) console.log(`  ${what}: ${chrome.box.w}x${chrome.box.h} at ${chrome.box.x},${chrome.box.y}`)
      continue
    }
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
        `  ${what}: ${chrome ? `${chrome.box.w}x${chrome.box.h} at ${chrome.box.x},${chrome.box.y}, paint ${chrome.paint}, radius ${chrome.radius}` : 'not there'}`
      )
    if (read.bar) console.log(`  bar: ${read.bar.box.w}x${read.bar.box.h}, paint ${read.bar.paint}, radius ${read.bar.radius}`)
    if (read.wide)
      console.log(
        `  a wide one: table ${read.wide.table} in ${read.wide.clientW}, scrolls ${read.wide.scrollW}, corner ${read.wide.corner}`
      )
  }
  console.log(`\nwrote the shots to ${shots}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
