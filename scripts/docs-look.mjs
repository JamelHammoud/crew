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

const HEIGHT = 900

const CASES = [
  ['rail pinned', 1440, true, 'ideas'],
  ['rail away', 1440, false, 'ideas'],
  ['a sub-page, rail pinned', 1440, true, 'handbook-a1b2/setup-c3d4'],
  ['narrow, rail pinned', 1120, true, 'ideas']
]

const DOCS = {
  ideas: { title: 'Ideas', text: '# Ideas\n\nTesting!\n\nA paragraph of ordinary writing so the measure can be read off the shot.\n' },
  'everything-9f2a': { title: "Everything I've added", text: 'A list of it.\n' },
  'handbook-a1b2': { title: 'This is a parent page', text: 'The parent.\n' },
  'handbook-a1b2/setup-c3d4': { title: 'Setting up', text: '# Setting up\n\nHow to get going.\n' }
}

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import Docs from ${from('views/Docs.tsx')}
import TopBar from ${from('components/TopBar.tsx')}
import WindowCorner from ${from('components/WindowCorner.tsx')}
import { SIDEBAR_W, useSidebar } from ${from('state/sidebar.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

const CASES = ${JSON.stringify(CASES)}

useCrew.setState({
  docs: ${JSON.stringify(DOCS)},
  selfId: 'self',
  selfName: 'Jamel',
  connection: 'online',
  members: [
    { id: 'self', name: 'Jamel', connected: true },
    { id: 'm1', name: 'Ali', connected: true }
  ]
})

function Page({ pinned, page }) {
  React.useEffect(() => {
    useSidebar.setState({ pinned })
    useCrew.setState({ docsTarget: page })
  }, [pinned, page])
  return React.createElement(
    'div',
    { className: 'h-full flex relative' },
    React.createElement('div', {
      'data-look-rail': 'true',
      className: 'shrink-0 h-full bg-ink-800 border-r border-[var(--glass-line)]',
      style: { width: pinned ? SIDEBAR_W : 0 }
    }),
    React.createElement(
      'div',
      { className: 'flex-1 min-w-0 relative isolate bg-ink-900' },
      React.createElement('main', { className: 'absolute inset-0' }, React.createElement(Docs)),
      React.createElement(
        'div',
        { className: 'absolute top-0 inset-x-0 z-40 pointer-events-none' },
        React.createElement('div', { className: 'page-scrim absolute inset-x-0 top-0' }),
        React.createElement(
          'div',
          { className: 'top-bar-container relative pointer-events-auto' },
          React.createElement(TopBar)
        )
      )
    ),
    React.createElement(WindowCorner)
  )
}

function Look() {
  const [at, setAt] = React.useState(0)
  const [, , pinned, page] = CASES[at]
  React.useEffect(() => {
    window.__step = next => setAt(next)
  }, [])
  return React.createElement(Page, { pinned, page })
}

createRoot(document.getElementById('root')).render(React.createElement(Look))
`
}

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-docs-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const CASES = ${JSON.stringify(CASES)}
const OUT = ${JSON.stringify(path.join(shots, 'docs'))}

const READ = \`(() => {
  const box = el => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), width: Math.round(r.width) }
  }
  const sel = q => box(document.querySelector(q))
  const rowOf = name => box([...document.querySelectorAll('[data-look-list] button')].find(b => (b.textContent || '').trim() === name))
  const paint = q => {
    const el = document.querySelector(q)
    return el ? getComputedStyle(el).backgroundColor : null
  }
  const lit = [...document.querySelectorAll('[data-look-list] [data-lit="true"]')].map(box)[0] || null
  return {
    rail: sel('[data-look-rail]'),
    list: sel('[data-look-list]'),
    lit,
    litPaint: paint('[data-look-list] [data-lit="true"]'),
    railPaint: paint('[data-look-rail]'),
    firstRow: rowOf('Ideas'),
    newPage: rowOf('New page'),
    title: sel('[data-look-title]'),
    body: sel('.bn-editor'),
    trail: sel('[data-look-trail]'),
    header: sel('header.top-bar')
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: CASES[0][1], height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  const seen = []
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(1200)
    for (let i = 0; i < CASES.length; i += 1) {
      win.setContentSize(CASES[i][1], ${HEIGHT})
      await win.webContents.executeJavaScript('window.__step(' + i + ')')
      await wait(500)
      seen.push(await win.webContents.executeJavaScript(READ))
      const shot = await win.webContents.capturePage()
      await writeFile(OUT + '-' + i + '.png', shot.toPNG())
    }
    console.log('SEEN ' + JSON.stringify(seen))
  } catch (e) {
    console.log('SEEN ' + JSON.stringify({ failed: String(e && e.stack) }))
  }
  app.exit(0)
})`

async function stage() {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-docs-look-')))
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
  seen.forEach((read, i) => {
    const [say, width] = CASES[i]
    console.log(`\n${say} (${width} wide)`)
    console.log(`  rail ends at ${read.rail?.right}, list ${read.list?.left} to ${read.list?.right}`)
    console.log(`  first row ${read.firstRow?.left} to ${read.firstRow?.right}, top ${read.firstRow?.top}`)
    console.log(`  lit row paint ${read.litPaint} against the rail's own ${read.railPaint}`)
    console.log(`  title ${read.title?.left} to ${read.title?.right}, top ${read.title?.top}`)
    console.log(`  body ${read.body?.left} to ${read.body?.right} (${read.body?.width} across)`)
    console.log(`  trail ${read.trail ? `${read.trail.left} to ${read.trail.right}, top ${read.trail.top}` : 'none'}`)
  })
  console.log(`\nwrote ${CASES.length} shots to ${shots}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
