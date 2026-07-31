import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

async function boardsIn(directory) {
  const found = []
  let entries = []
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...await boardsIn(target))
    else if (entry.isFile() && entry.name.endsWith('.json') && target.includes(`${path.sep}.crew${path.sep}designs${path.sep}`)) found.push(target)
  }
  return found
}

async function boardFile() {
  if (process.env.CREW_BOARD_CHECK) return realpath(process.env.CREW_BOARD_CHECK)
  const projects = path.join(homedir(), 'Library', 'Application Support', 'Crew', 'projects')
  const files = await boardsIn(projects)
  if (files.length === 0) throw new Error('No saved Crew board was found')
  const scored = await Promise.all(files.map(async file => {
    const saved = JSON.parse(await readFile(file, 'utf8'))
    const types = new Set(Object.values(saved.document?.store ?? {}).filter(record => record.typeName === 'shape').map(record => record.type))
    return { file, score: types.size }
  }))
  return scored.sort((a, b) => b.score - a.score)[0].file
}

function probeSource(snapshot) {
  const canvas = JSON.stringify(path.join(root, 'src/renderer/src/canvas/index.ts'))
  const shapes = JSON.stringify(path.join(root, 'src/renderer/src/design/shapeUtils.ts'))
  return `import React from 'react'
import { createRoot } from 'react-dom/client'
import { CrewCanvas, createTLStore, defaultBindingUtils, loadSnapshot } from ${canvas}
import { designShapeUtils } from ${shapes}
import './probe.css'

const store = createTLStore({ id: 'board-check' })
loadSnapshot(store, ${JSON.stringify(snapshot)})
const mounted = editor => {
  window.canvasEditor = editor
  requestAnimationFrame(() => {
    editor.zoomToFit({ immediate: true })
    window.canvasReady = true
  })
  return undefined
}
createRoot(document.getElementById('root')).render(
  React.createElement(CrewCanvas, {
    store,
    shapeUtils: designShapeUtils,
    bindingUtils: defaultBindingUtils,
    onMount: mounted
  })
)
`
}

const mainSource = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const errors = []
  const win = new BrowserWindow({ width: 1100, height: 760, show: true })
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(message)
  })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  for (let at = 0; at < 100; at++) {
    const ready = await win.webContents.executeJavaScript('Boolean(window.canvasReady)')
    if (ready) break
    await wait(50)
  }
  await wait(500)
  const result = await win.webContents.executeJavaScript(\`(async () => {
    const editor = window.canvasEditor
    if (!editor) return { failed: 'the editor never mounted' }
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const root = document.querySelector('[data-canvas="true"]')
    const shapes = editor.getCurrentPageShapesSorted()
    const byType = Object.fromEntries([...new Set(shapes.map(shape => shape.type))].map(type => [type, shapes.filter(shape => shape.type === type).length]))
    const painted = document.querySelectorAll('[data-canvas-shape="true"]').length
    const candidate = shapes.find(shape => ['geo', 'note', 'design-node', 'frame'].includes(shape.type) && editor.getShapeUtil(shape).canResize(shape))
    let moved = false
    let resized = false
    if (candidate && root) {
      const node = document.querySelector('[data-shape-id="' + candidate.id + '"][data-canvas-shape="true"]')
      const before = { x: candidate.x, y: candidate.y }
      const bounds = editor.getShapePageBounds(candidate)
      const center = editor.pageToViewport(bounds.center)
      const event = (name, x, y, buttons, target = root) => {
        const value = new PointerEvent(name, { bubbles: true, clientX: x, clientY: y, button: 0, buttons, pointerId: 1, pointerType: 'mouse', pressure: buttons ? 0.5 : 0 })
        target.dispatchEvent(value)
      }
      event('pointerdown', center.x, center.y, 1, node)
      event('pointermove', center.x + 24, center.y + 18, 1)
      event('pointerup', center.x + 24, center.y + 18, 0)
      await frame()
      const afterMove = editor.getShape(candidate.id)
      moved = Boolean(afterMove && (afterMove.x !== before.x || afterMove.y !== before.y))
      const beforeResize = editor.getShapePageBounds(candidate.id)
      const corner = editor.pageToViewport({ x: beforeResize.maxX, y: beforeResize.maxY })
      event('pointerdown', corner.x, corner.y, 1)
      event('pointermove', corner.x + 30, corner.y + 22, 1)
      event('pointerup', corner.x + 30, corner.y + 22, 0)
      await frame()
      const afterResize = editor.getShapePageBounds(candidate.id)
      resized = afterResize.w !== beforeResize.w || afterResize.h !== beforeResize.h
    }
    const snapNodes = shapes.slice(0, 2).map(shape => ({ id: shape.id, pageBounds: editor.getShapePageBounds(shape) }))
    let snapIndicators = 0
    if (snapNodes.length === 2) {
      const one = snapNodes[0].pageBounds
      const two = snapNodes[1].pageBounds
      const snap = editor.snaps.snapTranslateBounds({
        initialSelectionPageBounds: one,
        dragDelta: { x: two.minX - one.minX + 5, y: two.minY - one.minY + 5 },
        snappableShapes: [snapNodes[1]],
        zoom: editor.getZoomLevel()
      })
      editor.snaps.setIndicators(snap.indicators)
      snapIndicators = editor.overlays.getOverlayUtil('snap_indicator').isActive() ? snap.indicators.length : 0
      editor.snaps.clearIndicators()
    }
    const exported = await editor.getSvgString(shapes.slice(0, 8).map(shape => shape.id), { padding: 0 })
    return {
      records: shapes.length,
      painted,
      byType,
      drawPath: Boolean(document.querySelector('[data-shape-type="draw"] path')),
      richText: document.querySelectorAll('.crew-rich-text').length,
      moved,
      resized,
      snapIndicators,
      exported: Boolean(exported && exported.svg.includes('data-shape-id=')),
      editingTerms: document.documentElement.innerHTML.toLowerCase().includes('tld' + 'raw')
    }
  })()\`)
  const shot = await win.webContents.capturePage()
  console.log('BOARD ' + JSON.stringify({ ...result, pixels: !shot.isEmpty(), errors }))
  app.exit(0)
}).catch(error => {
  console.log('BOARD ' + JSON.stringify({ failed: String(error && error.stack || error) }))
  app.exit(1)
})
`

async function stage(file) {
  const saved = JSON.parse(await readFile(file, 'utf8'))
  if (!saved.document?.store || !saved.document?.schema) throw new Error(`${file} is not a Crew board`)
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-board-')))
  await writeFile(path.join(directory, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body><div id="root"></div></body></html>')
  await writeFile(path.join(directory, 'probe.tsx'), probeSource(saved.document))
  await writeFile(path.join(directory, 'probe.css'), `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@import "${path.join(root, 'src/renderer/src/canvas/canvas.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n`)
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
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', () => {})
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('The board check did not finish'))
    }, 60_000)
    child.on('exit', () => {
      clearTimeout(timeout)
      const line = output.split('\n').find(value => value.startsWith('BOARD '))
      if (!line) reject(new Error('The board window did not report a result'))
      else resolve(JSON.parse(line.slice(6)))
    })
    child.on('error', reject)
  })
}

const file = await boardFile()
const directory = await stage(file)
try {
  await compile(directory)
  const result = await run(directory)
  if (result.failed) throw new Error(result.failed)
  const problems = []
  if (result.records === 0) problems.push('the saved board had no shapes')
  if (result.painted !== result.records) problems.push(`${result.painted} of ${result.records} shapes painted`)
  if (result.byType.draw && !result.drawPath) problems.push('draw paths did not paint')
  if ((result.byType.text || result.byType.note || result.byType.geo) && result.richText === 0) problems.push('rich text did not paint')
  if (!result.moved) problems.push('a pointer drag did not move a shape')
  if (!result.resized) problems.push('a handle drag did not resize a shape')
  if (!result.snapIndicators) problems.push('snapping produced no visible indicators')
  if (!result.exported) problems.push('the board did not export to SVG')
  if (!result.pixels) problems.push('the window captured no pixels')
  if (result.editingTerms) problems.push('retired canvas terms reached the page')
  if (result.errors.length) problems.push(...result.errors.map(error => `window error: ${error}`))
  if (problems.length) throw new Error(problems.join('\n'))
  console.log(`${path.basename(file)} painted ${result.painted} shapes, dragged, resized, snapped, and exported`)
  console.log(`shape types: ${Object.entries(result.byType).map(([type, count]) => `${type} ${count}`).join(', ')}`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
