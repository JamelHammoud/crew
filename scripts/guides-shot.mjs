import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const resolve = createRequire(path.join(root, 'package.json')).resolve
const out = process.env.CREW_GUIDES_OUT ?? path.join(root, '.guides-shots')
const label = process.argv[2] ?? 'shot'
const surface = process.env.CREW_GUIDES_SURFACE === 'light' ? 'light' : ''

function probeSource() {
  const canvas = JSON.stringify(path.join(root, 'src/renderer/src/canvas/index.ts'))
  const shapes = JSON.stringify(path.join(root, 'src/renderer/src/design/shapeUtils.ts'))
  const nodeTool = JSON.stringify(path.join(root, 'src/renderer/src/design/DesignNodeTool.ts'))
  const defaults = JSON.stringify(path.join(root, 'src/renderer/src/design/defaults.ts'))
  const react = JSON.stringify(resolve('react'))
  const reactDom = JSON.stringify(resolve('react-dom/client'))
  return `import React from ${react}
import { createRoot } from ${reactDom}
import { CrewCanvas, createTLStore } from ${canvas}
import { designShapeUtils } from ${shapes}
import { DesignNodeTool } from ${nodeTool}
import { applyDesignDefaults } from ${defaults}
import './probe.css'

const store = createTLStore({ id: 'guides-shot' })
const box = (id, x, y, w, h) => ({
  id: 'shape:' + id,
  type: 'design-node',
  x,
  y,
  props: { w, h }
})
const mounted = editor => {
  window.canvasEditor = editor
  editor.user.updateUserPreferences({ isSnapMode: true, colorScheme: 'light' })
  applyDesignDefaults(editor)
  editor.createShapes([
    box('a', 0, 0, 160, 120),
    box('b', 240, 0, 160, 120),
    box('c', 480, 0, 160, 120),
    box('d', 300, 320, 160, 120)
  ])
  requestAnimationFrame(() => {
    window.canvasReady = true
  })
  return undefined
}
createRoot(document.getElementById('root')).render(
  React.createElement(CrewCanvas, {
    store,
    shapeUtils: designShapeUtils,
    bindingUtils: [],
    tools: [DesignNodeTool],
    onMount: mounted
  })
)
`
}

const driveSource = String.raw`(async (stage, zoom, look) => {
  const editor = window.canvasEditor
  if (!editor) return { failed: 'the editor never mounted' }
  const surface = document.querySelector('[data-canvas="true"]')
  const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
  const pointer = (name, x, y, buttons, target) =>
    (target || surface).dispatchEvent(
      new PointerEvent(name, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        pressure: buttons ? 0.5 : 0
      })
    )
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const dragged = 'shape:d'
  const held = { x: 800.5, y: 60.5 }

  if (stage === 'start') {
    editor.selectNone()
    editor.setCurrentTool('select')
    const shape = editor.getShape(dragged)
    editor.updateShape({ id: dragged, type: shape.type, x: 300, y: 320 })
    editor.setCamera({ x: 200, y: 260, z: 1 }, { immediate: true })
    await frame()
    const from = editor.pageToViewport({ x: 380, y: 380 })
    pointer('pointerdown', from.x, from.y, 1, nodeOf(dragged))
    await frame()
    const to = editor.pageToViewport(held)
    for (let step = 1; step <= 8; step++) {
      pointer('pointermove', from.x + ((to.x - from.x) * step) / 8, from.y + ((to.y - from.y) * step) / 8, 1)
      await frame()
    }
    return { ok: true }
  }

  if (stage === 'end') {
    const at = editor.pageToViewport(held)
    pointer('pointerup', at.x, at.y, 0)
    await frame()
    return { ok: true }
  }

  const bounds = editor.getViewportScreenBounds()
  editor.setCamera({ x: bounds.w / 2 / zoom - look.x, y: bounds.h / 2 / zoom - look.y, z: zoom }, { immediate: true })
  await frame()
  for (let rest = 0; rest < 12; rest++) {
    const at = editor.pageToViewport(held)
    pointer('pointermove', at.x, at.y, 1)
    await frame()
  }
  const indicators = editor.snaps.getIndicators()
  return {
    zoom: editor.getZoomLevel(),
    mode: editor.getColorMode(),
    indicators: indicators.map(one => one.type + (one.type === 'gaps' ? ':' + one.gaps.length : ':' + one.points.length))
  }
})`

const mainSource = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const zooms = [
  { name: 'whole', z: 1, look: { x: 420, y: 60 } },
  { name: 'far', z: 0.14, look: { x: 420, y: 60 } },
  { name: 'near', z: 4, look: { x: 700, y: 60 } }
]

app.whenReady().then(async () => {
  const errors = []
  const win = new BrowserWindow({ width: 1200, height: 760, show: true, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(String(message).slice(0, 200))
  })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  for (let at = 0; at < 200; at++) {
    const ready = await win.webContents.executeJavaScript('Boolean(window.canvasReady)').catch(() => false)
    if (ready) break
    await wait(50)
  }
  await wait(600)
  const drive = args => win.webContents.executeJavaScript('(' + ${JSON.stringify(driveSource)} + ')(' + args + ')')
  const shots = []
  await drive("'start'")
  for (const { name, z, look } of zooms) {
    let result = null
    try {
      result = await drive("'at'," + z + ',' + JSON.stringify(look))
    } catch (error) {
      result = { failed: String((error && error.message) || error) }
    }
    const shot = await win.webContents.capturePage()
    const file = path.join(${JSON.stringify(out)}, ${JSON.stringify(label)} + '-' + name + '.png')
    await fs.writeFile(file, shot.toPNG())
    shots.push({ name, file, ...result })
  }
  await drive("'end'").catch(() => {})
  console.log('GUIDES ' + JSON.stringify({ shots, errors: [...new Set(errors)].slice(0, 8) }))
  app.exit(0)
}).catch(error => {
  console.log('GUIDES ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

async function stage() {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-guides-')))
  await writeFile(
    path.join(directory, 'index.html'),
    `<!doctype html><html class="${surface}"><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body><div id="root"></div></body></html>`
  )
  await writeFile(path.join(directory, 'probe.tsx'), probeSource())
  await writeFile(
    path.join(directory, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@import "${path.join(root, 'src/renderer/src/canvas/canvas.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`
  )
  await writeFile(path.join(directory, 'main.cjs'), mainSource)
  return directory
}

async function compile(directory) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: directory,
    base: './',
    logLevel: 'silent',
    plugins: [tailwind()],
    build: { outDir: path.join(directory, 'dist'), emptyOutDir: true }
  })
}

function run(directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(directory, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', chunk => {
      output += chunk
    })
    child.stderr.on('data', () => {})
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('The guides shot did not finish'))
    }, 180_000)
    child.on('exit', () => {
      clearTimeout(timeout)
      const line = output.split('\n').find(value => value.startsWith('GUIDES '))
      if (!line) reject(new Error('The window did not report a result'))
      else resolve(JSON.parse(line.slice(7)))
    })
    child.on('error', reject)
  })
}

await mkdir(out, { recursive: true })
const directory = await stage()
try {
  await compile(directory)
  const result = await run(directory)
  if (result.failed) throw new Error(result.failed)
  for (const shot of result.shots)
    console.log(
      `${shot.name}  zoom ${shot.zoom ? shot.zoom.toFixed(2) : '?'}  ${shot.mode ?? '?'}  ${shot.indicators ? shot.indicators.join(', ') || 'no indicators' : shot.failed}\n      ${shot.file}`
    )
  for (const error of result.errors) console.log(`window error: ${error}`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
