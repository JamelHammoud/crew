import { rm } from 'node:fs/promises'
import { boardFile, compile, run, stage } from './board-window.mjs'

const driveSource = String.raw`(async () => {
  const editor = window.canvasEditor
  if (!editor) return { failed: 'the editor never mounted' }
  const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
  const settle = async (times = 3) => {
    for (let at = 0; at < times; at++) await frame()
  }
  const surface = document.querySelector('[data-canvas="true"]')
  const overlay = document.querySelector('[data-canvas-overlays="true"]')
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const box = () => editor.getContainer().getBoundingClientRect()
  const viewport = point => {
    const at = editor.pageToViewport(point)
    const rect = box()
    return { x: at.x + rect.left, y: at.y + rect.top }
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

  const calls = []
  const proto = CanvasRenderingContext2D.prototype
  const mine = context => context.canvas && context.canvas.getAttribute('data-canvas-overlays') === 'true'
  for (const name of ['clearRect', 'fillRect', 'strokeRect', 'stroke', 'fill']) {
    const original = proto[name]
    proto[name] = function (...args) {
      if (mine(this)) {
        const m = this.getTransform()
        calls.push({ name, args: args.filter(one => typeof one === 'number'), m: [m.a, m.b, m.c, m.d, m.e, m.f] })
      }
      return original.apply(this, args)
    }
  }
  const since = at => calls.slice(at)
  const active = () => editor.overlays.getActiveOverlayEntries().map(entry => entry.util.constructor.type)

  const report = { dpr: window.devicePixelRatio, overlay: Boolean(overlay), size: overlay ? [overlay.width, overlay.height] : null }

  editor.selectNone()
  editor.zoomToFit({ immediate: true })
  await settle(4)

  const shapes = editor.getCurrentPageShapesSorted()
  const target = shapes.filter(shape => {
    const bounds = editor.getShapePageBounds(shape)
    return bounds && bounds.w > 60 && bounds.h > 60
  })[0]

  const rect = box()
  const start = { x: rect.left + 20, y: rect.top + 20 }
  const marquee = []
  let mark = calls.length
  pointer('pointerdown', start.x, start.y, 1)
  await frame()
  for (let at = 1; at <= 6; at++) {
    mark = calls.length
    pointer('pointermove', start.x + at * 40, start.y + at * 30, 1)
    await frame()
    marquee.push({ at, path: editor.getCurrentToolPath(), active: active(), brush: editor.getInstanceState().brush, painted: since(mark) })
  }
  pointer('pointerup', start.x + 240, start.y + 180, 0)
  await settle()
  report.marquee = marquee

  editor.selectNone()
  await settle(2)
  const centre = viewport(editor.getShapePageBounds(target).center)
  mark = calls.length
  pointer('pointermove', centre.x, centre.y, 0, nodeOf(target.id))
  await frame()
  report.hover = {
    id: target.id,
    hovered: editor.getHoveredShapeId(),
    path: editor.getCurrentToolPath(),
    active: active(),
    painted: since(mark)
  }
  mark = calls.length
  pointer('pointermove', rect.left + 6, rect.top + 6, 0)
  await frame()
  report.unhover = { hovered: editor.getHoveredShapeId(), active: active(), painted: since(mark) }

  editor.select(target.id)
  await settle(3)
  const from = viewport(editor.getShapePageBounds(target).center)
  const dragged = []
  mark = calls.length
  report.beforeDrag = { path: editor.getCurrentToolPath(), active: active(), painted: since(mark) }
  pointer('pointerdown', from.x, from.y, 1, nodeOf(target.id))
  await frame()
  for (let at = 1; at <= 6; at++) {
    mark = calls.length
    pointer('pointermove', from.x + at * 12, from.y + at * 8, 1)
    await frame()
    dragged.push({
      at,
      path: editor.getCurrentToolPath(),
      active: active(),
      bounds: editor.getSelectionRotatedPageBounds(),
      painted: since(mark)
    })
  }
  pointer('pointerup', from.x + 72, from.y + 48, 0)
  await settle()
  report.drag = dragged

  const context = overlay.getContext('2d')
  const middle = context.getImageData(Math.round(overlay.width / 2), Math.round(overlay.height / 2), 1, 1).data
  report.pixel = [...middle]

  return report
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
  console.log('RECON ' + JSON.stringify({ ...result, errors: [...new Set(errors)].slice(0, 12) }))
  app.exit(0)
}).catch(error => {
  console.log('RECON ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

const file = await boardFile()
const directory = await stage(file, mainSource)
try {
  const result = await run(await compile(directory), 'RECON')
  console.log(JSON.stringify(result, null, 1))
} finally {
  await rm(directory, { recursive: true, force: true })
}
