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
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const box = () => editor.getContainer().getBoundingClientRect()
  const viewport = point => {
    const at = editor.pageToViewport(point)
    const rect = box()
    return { x: at.x + rect.left, y: at.y + rect.top }
  }
  const boundsOf = shape => editor.getShapePageBounds(shape)
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
  const drag = async (from, to, target) => {
    pointer('pointerdown', from.x, from.y, 1, target)
    await frame()
    for (let step = 1; step <= 6; step++) {
      pointer('pointermove', from.x + ((to.x - from.x) * step) / 6, from.y + ((to.y - from.y) * step) / 6, 1)
      await frame()
    }
    pointer('pointerup', to.x, to.y, 0)
    await settle()
  }
  const round = value => Math.round(value * 100) / 100

  const report = {}
  editor.setCurrentTool('select')
  editor.selectNone()
  editor.zoomToFit({ immediate: true })
  await settle(4)

  const container = box()
  report.geometry = {
    container: { left: round(container.left), top: round(container.top), w: round(container.width), h: round(container.height) },
    screenBounds: editor.getViewportScreenBounds(),
    zoom: round(editor.getZoomLevel())
  }

  const shapes = editor.getCurrentPageShapesSorted()
  const oneOf = type => shapes.find(shape => shape.type === type)

  report.aim = []
  for (const type of ['design-node', 'frame', 'group', 'text', 'draw', 'note']) {
    const shape = oneOf(type)
    if (!shape) continue
    const bounds = boundsOf(shape)
    if (!bounds) continue
    const at = viewport(bounds.center)
    const under = document.elementFromPoint(at.x, at.y)
    const painted = under && under.closest ? under.closest('[data-canvas-shape="true"]') : null
    const hit = editor.getShapeAtPoint(bounds.center, {
      margin: editor.options.hitTestMargin / editor.getZoomLevel(),
      hitInside: true,
      renderingOnly: true
    })
    const parent = editor.getShapeParent(shape)
    editor.selectNone()
    await settle()
    const before = editor.getShape(shape.id)
    await drag(at, { x: at.x + 44, y: at.y + 32 }, nodeOf(hit ? hit.id : shape.id))
    const after = editor.getShape(shape.id)
    const selected = editor.getSelectedShapeIds()
    const movedShape = after && (after.x !== before.x || after.y !== before.y)
    if (movedShape) editor.updateShape({ id: shape.id, type: shape.type, x: before.x, y: before.y })
    report.aim.push({
      type,
      id: shape.id,
      parent: parent ? parent.type + ':' + parent.id : 'page',
      aimedAt: { x: round(at.x), y: round(at.y) },
      insideContainer: at.x >= container.left && at.x <= container.right && at.y >= container.top && at.y <= container.bottom,
      elementUnder: painted ? painted.getAttribute('data-shape-id') : under ? under.tagName + '.' + String(under.className).slice(0, 40) : 'nothing',
      hitTest: hit ? hit.type + ':' + hit.id : 'nothing',
      movedTheShape: Boolean(movedShape),
      selected: selected.map(id => {
        const one = editor.getShape(id)
        return one ? one.type + ':' + id : id
      })
    })
    await settle()
  }

  editor.selectNone()
  editor.zoomToFit({ immediate: true })
  await settle()
  const all = editor.getCurrentPageBounds()
  await drag(viewport({ x: all.minX - 30, y: all.minY - 30 }), viewport(all.center))
  report.marquee = {
    selected: editor.getSelectedShapeIds().map(id => {
      const one = editor.getShape(id)
      return one ? one.type : id
    }),
    topLevel: editor.getCurrentPageShapes().filter(shape => String(shape.parentId).startsWith('page:')).length,
    groupsOnBoard: editor.getCurrentPageShapes().filter(shape => shape.type === 'group').length
  }

  const panel = document.querySelector('[data-probe-panel]')
  const aside = panel ? panel.querySelector('aside') : null
  const measure = which => {
    const half = document.querySelector('[data-design-' + which + ']')
    if (!half) return { missing: true }
    const scroller = half.querySelector('.overflow-y-auto')
    const chain = []
    let node = scroller
    while (node && node !== document.body) {
      const style = getComputedStyle(node)
      chain.push({
        tag: node.tagName.toLowerCase() + (node.getAttribute('data-design-layers') !== null ? '[layers]' : '') + (node.getAttribute('data-design-inspector') !== null ? '[inspector]' : '') + (node.getAttribute('data-probe-panel') !== null ? '[panel]' : ''),
        display: style.display,
        direction: style.flexDirection,
        grow: style.flexGrow,
        minHeight: style.minHeight,
        overflowY: style.overflowY,
        height: round(node.getBoundingClientRect().height),
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight
      })
      node = node.parentElement
    }
    if (!scroller) return { noScroller: true, chain }
    scroller.scrollTop = 0
    scroller.scrollTop = 9999
    const landed = scroller.scrollTop
    scroller.scrollTop = 0
    return {
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      scrolled: landed,
      chain
    }
  }

  editor.selectNone()
  await settle(4)
  report.layers = measure('layers')
  editor.select(shapes[0].id)
  await settle(6)
  report.inspector = measure('inspector')
  report.panel = {
    windowHeight: window.innerHeight,
    asideHeight: aside ? round(aside.getBoundingClientRect().height) : null,
    asideScrollHeight: aside ? aside.scrollHeight : null,
    rootHeight: round(document.getElementById('root').getBoundingClientRect().height)
  }
  editor.selectNone()
  await settle()

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
  console.log('PROBE ' + JSON.stringify({ ...result, errors: [...new Set(errors)].slice(0, 12) }))
  app.exit(0)
}).catch(error => {
  console.log('PROBE ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

const file = await boardFile()
const directory = await stage(file, mainSource)
try {
  const result = await run(await compile(directory), 'PROBE')
  console.log('\n=== geometry', JSON.stringify(result.geometry))
  console.log('=== aiming')
  for (const one of result.aim ?? []) console.log(' ', JSON.stringify(one))
  console.log('=== marquee', JSON.stringify(result.marquee))
  console.log('=== layers', JSON.stringify(result.layers, null, 1))
  console.log('=== inspector', JSON.stringify(result.inspector, null, 1))
  console.log('=== panel', JSON.stringify(result.panel))
  console.log('=== errors', JSON.stringify(result.errors))
  if (result.failed) console.log('=== failed', result.failed)
} finally {
  await rm(directory, { recursive: true, force: true })
}
