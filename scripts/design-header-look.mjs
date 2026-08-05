import { spawn } from 'node:child_process'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
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

const CASES = [
  ['both', true, true, false],
  ['layers away', false, true, false],
  ['chat away', true, false, false],
  ['both away', false, false, false],
  ['both, rail pinned', true, true, true],
  ['both away, rail pinned', false, false, true]
]

function probeSource() {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  return `import React from ${JSON.stringify(resolve('react'))}
import { createRoot } from ${JSON.stringify(resolve('react-dom/client'))}
import { createTLStore, EditorContext } from ${from('canvas/index.ts')}
import { Editor } from ${from('canvas/editor/index.ts')}
import { HandTool, SelectTool } from ${from('canvas/tools/index.ts')}
import DesignHeader from ${from('components/DesignHeader.tsx')}
import { DesignBoardContext } from ${from('components/DesignPanels.tsx')}
import TopBar, { TOP_BAR_H } from ${from('components/TopBar.tsx')}
import WindowCorner from ${from('components/WindowCorner.tsx')}
import { LEFT_PANEL_W, RIGHT_PANEL_W } from ${from('design/headerBand.ts')}
import { designShapeUtils } from ${from('design/shapeUtils.ts')}
import { SIDEBAR_W, useSidebar } from ${from('state/sidebar.ts')}
import { useCrew } from ${from('state/store.ts')}
import './probe.css'

const CASES = ${JSON.stringify(CASES)}

const editor = new Editor({
  store: createTLStore({ id: 'design-header-look', shapeUtils: designShapeUtils }),
  shapeUtils: designShapeUtils,
  tools: [SelectTool, HandTool],
  getContainer: () => document.body
})
editor.setViewportScreenBounds({ x: 0, y: 0, w: 900, h: 700 })

useCrew.setState({
  boards: [{ id: 'b1', name: 'App design' }],
  selfId: 'self',
  selfName: 'Jamel',
  connection: 'online',
  members: [
    { id: 'self', name: 'Jamel', connected: true },
    { id: 'm1', name: 'Ali', connected: true }
  ]
})

function Page({ panels, pinned }) {
  React.useEffect(() => {
    useSidebar.setState({ pinned })
  }, [pinned])
  return React.createElement(
    'div',
    { className: 'h-full flex relative' },
    React.createElement('div', {
      className: 'shrink-0 h-full bg-ink-900 border-r border-ink-700',
      style: { width: pinned ? SIDEBAR_W : 0 }
    }),
    React.createElement(
      'div',
      { className: 'flex-1 min-w-0 relative isolate bg-ink-900' },
      React.createElement(
        'main',
        { className: 'absolute inset-0' },
        React.createElement(
          EditorContext.Provider,
          { value: editor },
          React.createElement(
            DesignBoardContext.Provider,
            { value: { current: 'b1', select: () => {} } },
            React.createElement(
              'div',
              { className: 'h-full flex flex-col design', style: { paddingTop: TOP_BAR_H } },
              React.createElement(DesignHeader, { editor, panels }),
              React.createElement(
                'div',
                { className: 'flex-1 min-h-0 flex' },
                panels.left &&
                  React.createElement('aside', {
                    'data-look-left': 'true',
                    className: 'shrink-0 bg-ink-900 border-r border-ink-700',
                    style: { width: LEFT_PANEL_W }
                  }),
                React.createElement('div', {
                  'data-look-canvas': 'true',
                  className: 'flex-1 min-w-0',
                  style: { background: 'var(--design-canvas)' }
                }),
                panels.right &&
                  React.createElement('aside', {
                    'data-look-right': 'true',
                    className: 'shrink-0 bg-ink-900 border-l border-ink-700',
                    style: { width: RIGHT_PANEL_W }
                  })
              )
            )
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'absolute top-0 inset-x-0 z-40 pointer-events-none' },
        React.createElement(
          'div',
          { className: 'top-bar-container pointer-events-auto bg-ink-900' },
          React.createElement(TopBar)
        )
      )
    ),
    React.createElement(WindowCorner)
  )
}

function Look() {
  const [at, setAt] = React.useState(0)
  const [, left, right, pinned] = CASES[at]
  React.useEffect(() => {
    window.__step = next => setAt(next)
  }, [])
  return React.createElement(Page, { panels: { left, right }, pinned })
}

createRoot(document.getElementById('root')).render(React.createElement(Look))
`
}

const shots = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-design-header-shots-')))

const MAIN = `const { app, BrowserWindow } = require('electron')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
app.disableHardwareAcceleration()

const wait = ms => new Promise(r => setTimeout(r, ms))
const CASES = ${JSON.stringify(CASES)}
const OUT = ${JSON.stringify(path.join(shots, 'design-header'))}

const READ = \`(() => {
  const box = sel => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }
  }
  const named = name => {
    const el = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent || '').includes(name))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right) }
  }
  const band = document.querySelector('[data-design-band]')
  const paint = sel => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el).backgroundColor : null
  }
  return {
    width: window.innerWidth,
    name: named('App design'),
    letters: box('[data-design-name] button > span'),
    zoom: named('Zoom'),
    undo: named('Undo'),
    face: named('Settings'),
    corner: box('.app-drag.absolute'),
    leftPanel: box('[data-look-left]'),
    canvas: box('[data-look-canvas]'),
    rightPanel: box('[data-look-right]'),
    bandLeft: box('[data-design-band-left]'),
    bandRight: box('[data-design-band-right]'),
    bandCanvas: paint('[data-design-band] > div:not([data-design-band-left]):not([data-design-band-right])'),
    canvasPaint: paint('[data-look-canvas]')
  }
})()\`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: ${WIDTH}, height: ${HEIGHT}, show: true, backgroundColor: '#141414' })
  const seen = []
  try {
    await win.loadFile(path.join(__dirname, 'dist/index.html'))
    await wait(900)
    for (let i = 0; i < CASES.length; i += 1) {
      await win.webContents.executeJavaScript('window.__step(' + i + ')')
      await wait(350)
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
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-design-header-')))
  await writeFile(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body class="mac"><div id="root"></div></body></html>'
  )
  await writeFile(path.join(dir, 'probe.tsx'), probeSource())
  await writeFile(
    path.join(dir, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@import "${path.join(root, 'src/renderer/src/canvas/canvas.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n#root { position: relative; }\n`
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
    const [say] = CASES[i]
    console.log(`\n${say}`)
    console.log(`  window corner ends at ${read.corner?.right}`)
    console.log(`  canvas ${read.canvas?.left} to ${read.canvas?.right}`)
    console.log(`  board name ${read.name?.left} to ${read.name?.right}`)
    console.log(`  undo at ${read.undo?.left}, zoom ends at ${read.zoom?.right}, your face ${read.face?.left} to ${read.face?.right}`)
    console.log(`  band left ${read.bandLeft ? `${read.bandLeft.left} to ${read.bandLeft.right}` : 'none'}, band right ${read.bandRight ? `${read.bandRight.left} to ${read.bandRight.right}` : 'none'}`)
    console.log(`  band over the canvas ${read.bandCanvas} against the canvas itself ${read.canvasPaint}`)
    const nameOn = read.name && read.canvas && read.name.left === read.canvas.left
    const zoomOn = read.zoom && read.canvas && read.zoom.right === read.canvas.right
    console.log(`  name on the canvas edge: ${nameOn ? 'yes' : 'NO'}   zoom on the canvas edge: ${zoomOn ? 'yes' : 'NO'}`)
    const [, left] = CASES[i]
    if (!left && read.letters && read.canvas && read.face) {
      const front = read.letters.left - read.canvas.left
      const back = read.width - read.face.right
      console.log(`  name letters ${front} from the canvas edge, face ${back} from the window edge: ${front === back ? 'level' : 'OFF BY ' + (front - back)}`)
    }
    console.log(`  band matches the canvas colour: ${read.bandCanvas === read.canvasPaint ? 'yes' : 'NO'}`)
  })
  console.log(`\nwrote ${CASES.length} shots to ${shots}`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
