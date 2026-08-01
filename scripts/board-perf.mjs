import { rm } from 'node:fs/promises'
import { mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { boardFile, byShapeCount, root, run } from './board-window.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const resolve = createRequire(path.join(root, 'package.json')).resolve

const MOVES = 60
const DEV = process.env.CREW_PERF_DEV === '1'

function probeSource(snapshot) {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  const react = JSON.stringify(resolve('react'))
  const reactDom = JSON.stringify(resolve('react-dom/client'))
  return `import React from ${react}
import { createRoot } from ${reactDom}
import { createTLStore, defaultBindingUtils, EditorContext, loadSnapshot, useValue } from ${from('canvas/index.ts')}
import { CrewCanvas } from ${from('canvas/CrewCanvas.tsx')}
import DesignLeftPanel from ${from('components/DesignLeftPanel.tsx')}
import { applyDesignCursors, DESIGN_CURSORS } from ${from('design/cursors.tsx')}
import { applyDesignDefaults } from ${from('design/defaults.ts')}
import { DesignNodeTool } from ${from('design/DesignNodeTool.ts')}
import SelectionOverlay from ${from('design/SelectionOverlay.tsx')}
import { selectionStroke } from ${from('design/selectionColor.ts')}
import { designShapeUtils } from ${from('design/shapeUtils.ts')}
import { keepWholePixels } from ${from('design/wholePixels.ts')}
import './probe.css'

const store = createTLStore({ id: 'board-perf' })
loadSnapshot(store, ${JSON.stringify(snapshot)})

window.__perf = { commits: 0, duration: 0, counts: {}, start: performance.now(), ready: 0 }

function Board() {
  const [editor, setEditor] = React.useState(null)
  const selected = useValue('design selected color', () => (editor ? selectionStroke(editor) : null), [editor])
  const mounted = React.useCallback(editor => {
    applyDesignDefaults(editor)
    applyDesignCursors(editor.getContainer())
    editor.user.updateUserPreferences({ isSnapMode: true, colorScheme: 'light' })
    const stopRounding = keepWholePixels(editor)
    setEditor(editor)
    window.canvasEditor = editor
    requestAnimationFrame(() => {
      editor.zoomToFit({ immediate: true })
      window.__perf.ready = performance.now()
      window.canvasReady = true
    })
    return () => stopRounding()
  }, [])
  const onRender = React.useCallback((_id, _phase, actual) => {
    window.__perf.commits += 1
    window.__perf.duration += actual
  }, [])
  return React.createElement(
    React.Profiler,
    { id: 'board', onRender },
    React.createElement(
      'div',
      {
        className: 'absolute inset-0 design',
        style: { ...DESIGN_CURSORS, cursor: 'var(--crew-cursor-default)', '--design-selected': selected }
      },
      React.createElement(CrewCanvas, {
        store,
        shapeUtils: designShapeUtils,
        bindingUtils: defaultBindingUtils,
        tools: [DesignNodeTool],
        onMount: mounted
      }),
      React.createElement(SelectionOverlay, { editor }),
      editor && React.createElement(EditorContext.Provider, { value: editor }, React.createElement(DesignLeftPanel))
    )
  )
}

createRoot(document.getElementById('root')).render(React.createElement(Board))
`
}

const driveSource = String.raw`(async () => {
  const editor = window.canvasEditor
  if (!editor) return { failed: 'the editor never mounted' }
  const perf = window.__perf
  const surface = document.querySelector('[data-canvas="true"]')
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const frame = () => new Promise(done => requestAnimationFrame(done))
  const settle = async (times = 3) => {
    for (let at = 0; at < times; at++) await frame()
  }

  const watched = [
    'getCurrentPageShapesSorted',
    'getCurrentPageShapes',
    'getCurrentPageShapeIds',
    'getRenderingShapes',
    'getCulledShapes',
    'getShapeGeometry',
    'getShapePageBounds',
    'getShapePageTransform',
    'getShapeIdsInsideBounds',
    'getSnappableShapes',
    'getSortedChildIdsForParent',
    'getShapeClipPath'
  ]
  if (${process.env.CREW_PERF_CACHE === '1'}) {
    const geometry = new WeakMap()
    const original = editor.getShapeGeometry.bind(editor)
    editor.getShapeGeometry = function (shapeOrId) {
      const shape = typeof shapeOrId === 'string' ? editor.getShape(shapeOrId) : shapeOrId
      if (!shape || shape.type === 'group') return original(shapeOrId)
      const hit = geometry.get(shape)
      if (hit) return hit
      const value = original(shape)
      geometry.set(shape, value)
      return value
    }
  }

  perf.times = {}
  let depth = 0
  for (const name of watched) {
    if (typeof editor[name] !== 'function') continue
    const original = editor[name].bind(editor)
    perf.counts[name] = 0
    perf.times[name] = 0
    editor[name] = function (...args) {
      perf.counts[name] += 1
      if (depth > 0) return original(...args)
      depth += 1
      const began = performance.now()
      try {
        return original(...args)
      } finally {
        depth -= 1
        perf.times[name] += performance.now() - began
      }
    }
  }
  const resetCounts = () => {
    for (const name of Object.keys(perf.counts)) perf.counts[name] = 0
    for (const name of Object.keys(perf.times)) perf.times[name] = 0
    perf.commits = 0
    perf.duration = 0
  }

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

  const summarise = samples => {
    const sorted = [...samples].sort((a, b) => a - b)
    const total = sorted.reduce((sum, value) => sum + value, 0)
    return {
      mean: Number((total / sorted.length).toFixed(2)),
      median: Number(sorted[Math.floor(sorted.length / 2)].toFixed(2)),
      p95: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
      worst: Number(sorted[sorted.length - 1].toFixed(2))
    }
  }

  const measure = async (label, start, step, target) => {
    resetCounts()
    const sync = []
    const framed = []
    pointer('pointerdown', start.x, start.y, 1, target)
    await frame()
    const before = JSON.parse(JSON.stringify(perf.counts))
    resetCounts()
    for (let at = 1; at <= ${MOVES}; at++) {
      const x = start.x + step.x * at
      const y = start.y + step.y * at
      const began = performance.now()
      pointer('pointermove', x, y, 1)
      const dispatched = performance.now()
      await frame()
      const painted = performance.now()
      sync.push(dispatched - began)
      framed.push(painted - began)
    }
    const counts = {}
    for (const [name, value] of Object.entries(perf.counts)) counts[name] = Math.round(value / ${MOVES})
    const times = {}
    for (const [name, value] of Object.entries(perf.times)) times[name] = Number((value / ${MOVES}).toFixed(3))
    const commits = perf.commits
    const duration = perf.duration
    pointer('pointerup', start.x + step.x * ${MOVES}, start.y + step.y * ${MOVES}, 0)
    await settle()
    void before
    return {
      label,
      sync: summarise(sync),
      frame: summarise(framed),
      commitsPerMove: Number((commits / ${MOVES}).toFixed(2)),
      reactMsPerMove: Number((duration / ${MOVES}).toFixed(2)),
      perMove: counts,
      msPerMove: times
    }
  }

  const measureSelections = async targets => {
    resetCounts()
    const sync = []
    const framed = []
    const selected = new Set()
    for (let at = 0; at < ${MOVES}; at++) {
      const target = targets[at % targets.length]
      const bounds = editor.getShapePageBounds(target.id)
      const point = viewport(bounds.center)
      const began = performance.now()
      pointer('pointerdown', point.x, point.y, 1, nodeOf(target.id))
      pointer('pointerup', point.x, point.y, 0, nodeOf(target.id))
      selected.add(editor.getSelectedShapeIds().join(','))
      const dispatched = performance.now()
      await frame()
      const painted = performance.now()
      sync.push(dispatched - began)
      framed.push(painted - began)
    }
    const counts = {}
    for (const [name, value] of Object.entries(perf.counts)) counts[name] = Math.round(value / ${MOVES})
    const times = {}
    for (const [name, value] of Object.entries(perf.times)) times[name] = Number((value / ${MOVES}).toFixed(3))
    return {
      label: 'select',
      sync: summarise(sync),
      frame: summarise(framed),
      commitsPerMove: Number((perf.commits / ${MOVES}).toFixed(2)),
      reactMsPerMove: Number((perf.duration / ${MOVES}).toFixed(2)),
      perMove: counts,
      msPerMove: times,
      selected: selected.size
    }
  }

  const viewport = point => editor.pageToViewport(point)
  const shapes = editor.getCurrentPageShapesSorted()
  const centre = editor.getViewportPageBounds().center
  const near = shapes
    .filter(shape => {
      const bounds = editor.getShapePageBounds(shape)
      return bounds && bounds.w > 30 && bounds.h > 30 && editor.getShapeUtil(shape).canResize(shape)
    })
    .sort((a, b) => {
      const one = editor.getShapePageBounds(a).center
      const other = editor.getShapePageBounds(b).center
      return (one.x - centre.x) ** 2 + (one.y - centre.y) ** 2 - ((other.x - centre.x) ** 2 + (other.y - centre.y) ** 2)
    })[0]
  if (!near) return { failed: 'no resizable shape to drag' }

  const results = []

  const selectionTargets = shapes
    .filter(shape => shape.parentId === editor.getCurrentPageId() && editor.getShapePageBounds(shape))
    .slice(0, 24)
  if (selectionTargets.length < 2) return { failed: 'not enough top-level shapes to select' }
  results.push(await measureSelections(selectionTargets))

  editor.selectNone()
  await settle()
  const viewportBounds = editor.getViewportScreenBounds()
  const marqueeStart = { x: viewportBounds.minX + 8, y: viewportBounds.minY + 8 }
  results.push(await measure('marquee', marqueeStart, { x: 6, y: 4 }, surface))

  editor.selectNone()
  editor.zoomToFit({ immediate: true })
  await settle()
  const whole = editor.getViewportScreenBounds()
  const wide = await measure(
    'marquee across the board',
    { x: whole.minX + 6, y: whole.minY + 6 },
    { x: (whole.w - 12) / ${MOVES}, y: (whole.h - 12) / ${MOVES} },
    surface
  )
  wide.covered = editor.getSelectedShapeIds().length
  wide.topLevel = shapes.filter(shape => shape.parentId === editor.getCurrentPageId()).length
  results.push(wide)

  editor.selectNone()
  await settle()
  const grabAt = viewport(editor.getShapePageBounds(near).center)
  const grabbed = editor.getShapeAtPoint(editor.getShapePageBounds(near).center, {
    margin: editor.options.hitTestMargin / editor.getZoomLevel(),
    hitInside: true,
    renderingOnly: true
  })
  results.push(await measure('drag', grabAt, { x: 1.5, y: 1 }, nodeOf((grabbed || near).id)))

  const home = editor.getShape((grabbed || near).id)
  editor.select(near.id)
  await settle()
  const bounds = editor.getShapePageBounds(near)
  const corner = viewport({ x: bounds.maxX, y: bounds.maxY })
  results.push(await measure('resize', corner, { x: 1.5, y: 1 }, undefined))
  void home

  return {
    results,
    shapes: shapes.length,
    mounted: document.querySelectorAll('[data-canvas-shape="true"]').length,
    culled: editor.getCulledShapes().size,
    mountMs: Number((perf.ready - perf.start).toFixed(1))
  }
})()`

const mainSource = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const errors = []
  const win = new BrowserWindow({ width: 1400, height: 900, show: true, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(String(message).slice(0, 200))
  })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  for (let at = 0; at < 200; at++) {
    const ready = await win.webContents.executeJavaScript('Boolean(window.canvasReady)').catch(() => false)
    if (ready) break
    await wait(50)
  }
  await wait(1200)
  let result = null
  try {
    result = await win.webContents.executeJavaScript(${JSON.stringify(driveSource)})
  } catch (error) {
    result = { failed: String((error && error.message) || error) }
  }
  console.log('PERF ' + JSON.stringify({ ...result, errors: [...new Set(errors)].slice(0, 12) }))
  app.exit(0)
}).catch(error => {
  console.log('PERF ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

async function stage(file) {
  const saved = JSON.parse(await readFile(file, 'utf8'))
  if (!saved.document?.store || !saved.document?.schema) throw new Error(`${file} is not a Crew board`)
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-perf-')))
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body><div id="root"></div></body></html>'
  )
  await writeFile(path.join(directory, 'probe.tsx'), probeSource(saved.document))
  await writeFile(
    path.join(directory, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@import "${path.join(root, 'src/renderer/src/canvas/canvas.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n#root { position: relative; }\n`
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
    mode: DEV ? 'development' : 'production',
    define: DEV ? { 'process.env.NODE_ENV': '"development"' } : undefined,
    plugins: [tailwind()],
    build: { outDir: path.join(directory, 'dist'), emptyOutDir: true, minify: !DEV }
  })
  return directory
}

const file = await boardFile(byShapeCount)
const directory = await stage(file)
try {
  const result = await run(await compile(directory), 'PERF')
  if (result.failed) throw new Error(`${result.failed}${result.errors?.length ? `\n${result.errors.join('\n')}` : ''}`)
  console.log(
    `${path.basename(file)}: ${result.shapes} shapes, ${result.mounted} mounted, ${result.culled} culled, ${result.mountMs}ms to open\n`
  )
  for (const run of result.results) {
    console.log(`${run.label}, ${MOVES} interactions`)
    console.log(
      `  handler   mean ${run.sync.mean}ms  median ${run.sync.median}ms  p95 ${run.sync.p95}ms  worst ${run.sync.worst}ms`
    )
    console.log(
      `  to frame  mean ${run.frame.mean}ms  median ${run.frame.median}ms  p95 ${run.frame.p95}ms  worst ${run.frame.worst}ms`
    )
    console.log(`  react     ${run.commitsPerMove} commits a move, ${run.reactMsPerMove}ms a move`)
    if (run.selected !== undefined) console.log(`  selected  ${run.selected} distinct selections`)
    if (run.covered !== undefined)
      console.log(
        `  covered   ${run.covered} shapes of the ${run.topLevel} standing at the top of the board, the rest inside frames a marquee takes whole`
      )
    const calls = Object.entries(run.perMove)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} ${count}`)
    console.log(`  a move    ${calls.join(', ')}`)
    const spent = Object.entries(run.msPerMove ?? {})
      .filter(([, ms]) => ms > 0.01)
      .sort((a, b) => b[1] - a[1])
      .map(([name, ms]) => `${name} ${ms}ms`)
    console.log(`  spent     ${spent.join(', ')}\n`)
  }
  const selecting = result.results.find(run => run.label === 'select')
  const marquee = result.results.find(run => run.label === 'marquee')
  if (!selecting || selecting.selected < 2) throw new Error('selection performance check did not change selection')
  if (selecting.sync.p95 > 8) throw new Error(`selection handler p95 reached ${selecting.sync.p95}ms`)
  if (selecting.frame.p95 > 16) throw new Error(`selection paint p95 reached ${selecting.frame.p95}ms`)
  if (selecting.frame.worst > 80) throw new Error(`selection paint stalled for ${selecting.frame.worst}ms`)
  if (!marquee) throw new Error('marquee performance check did not run')
  if (marquee.sync.p95 > 4) throw new Error(`marquee handler p95 reached ${marquee.sync.p95}ms`)
  if (marquee.frame.p95 > 16) throw new Error(`marquee paint p95 reached ${marquee.frame.p95}ms`)
  const wide = result.results.find(run => run.label === 'marquee across the board')
  if (!wide) throw new Error('the wide marquee performance check did not run')
  if (wide.covered < wide.topLevel / 2)
    throw new Error(`the wide marquee covered ${wide.covered} of ${wide.topLevel} shapes, so the expensive case went unmeasured`)
  for (const error of result.errors ?? []) console.log(`window error: ${error}`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
