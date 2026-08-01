import { rm } from 'node:fs/promises'
import path from 'node:path'
import { boardFile, compile, run, stage } from './board-window.mjs'

const driveSource = String.raw`(async () => {
  const editor = window.canvasEditor
  if (!editor) return { failed: 'the editor never mounted' }
  const checks = []
  const say = (name, ok, note) => checks.push({ name, ok: Boolean(ok), note: note === undefined ? '' : String(note) })
  const attempt = async (name, run) => {
    try {
      const result = await run()
      if (result === null) return
      say(name, result === undefined ? true : result.ok !== false, result && result.note)
    } catch (error) {
      say(name, false, 'threw: ' + (error && error.message ? error.message : error))
    }
  }
  const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
  const settle = async (times = 3) => {
    for (let at = 0; at < times; at++) await frame()
  }
  const surface = document.querySelector('[data-canvas="true"]')
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const pointer = (name, x, y, buttons, target, modifiers) =>
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
        pressure: buttons ? 0.5 : 0,
        ...modifiers
      })
    )
  const keyEvent = (name, key, modifiers) => {
    const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : surface
    target.dispatchEvent(
      new KeyboardEvent(name, {
        bubbles: true,
        cancelable: true,
        key,
        code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
        ...modifiers
      })
    )
  }
  const press = (key, modifiers) => {
    keyEvent('keydown', key, modifiers)
    keyEvent('keyup', key, modifiers)
  }
  const drag = async (from, to, options) => {
    const settings = options || {}
    pointer('pointerdown', from.x, from.y, 1, settings.target, settings.modifiers)
    await frame()
    for (let step = 1; step <= 6; step++) {
      pointer(
        'pointermove',
        from.x + ((to.x - from.x) * step) / 6,
        from.y + ((to.y - from.y) * step) / 6,
        1,
        undefined,
        settings.modifiers
      )
      await frame()
    }
    pointer('pointerup', to.x, to.y, 0, undefined, settings.modifiers)
    await settle()
  }
  const viewport = point => editor.pageToViewport(point)
  const boundsOf = shape => editor.getShapePageBounds(shape)
  const restore = async (shape, before) => {
    editor.updateShape({ id: shape.id, type: shape.type, x: before.x, y: before.y, rotation: before.rotation })
    await frame()
  }

  const shapes = editor.getCurrentPageShapesSorted()
  const byType = {}
  for (const shape of shapes) byType[shape.type] = (byType[shape.type] || 0) + 1
  const present = Object.keys(byType)
  const oneOf = type => shapes.find(shape => shape.type === type)

  say('shapes painted', document.querySelectorAll('[data-canvas-shape="true"]').length === shapes.length, document.querySelectorAll('[data-canvas-shape="true"]').length + ' of ' + shapes.length)
  if (byType.draw) say('draw paths painted', Boolean(document.querySelector('[data-shape-type="draw"] path')))
  if (byType.text || byType.note || byType.geo)
    say('rich text painted', document.querySelectorAll('.crew-rich-text').length > 0, document.querySelectorAll('.crew-rich-text').length + ' runs')
  say('no retired canvas terms', !document.documentElement.innerHTML.toLowerCase().includes('tld' + 'raw'))

  for (const type of present) {
    const shape = oneOf(type)
    if (!editor.getShapeUtil(shape).canResize(shape) && type !== 'text' && type !== 'draw') continue
    await attempt('a drag moves a ' + type, async () => {
      editor.selectNone()
      await frame()
      const centre = boundsOf(shape).center
      const grabbed = editor.getShapeAtPoint(centre, {
        margin: editor.options.hitTestMargin / editor.getZoomLevel(),
        hitInside: true,
        renderingOnly: true
      })
      if (!grabbed) return { ok: true, note: 'nothing sits at its centre' }
      const before = editor.getShape(grabbed.id)
      const at = viewport(centre)
      await drag(at, { x: at.x + 44, y: at.y + 32 }, { target: nodeOf(grabbed.id) })
      const after = editor.getShape(grabbed.id)
      const moved = after.x !== before.x || after.y !== before.y
      if (moved) await restore(grabbed, before)
      const selected = editor.getSelectedShapeIds().includes(grabbed.id)
      const over = grabbed.id === shape.id ? '' : ', over it'
      if (moved) return { ok: true, note: 'moved the ' + grabbed.type + over }
      if (selected) return { ok: true, note: 'selected the ' + grabbed.type + over + ', which is not dragged from here' }
      return { ok: false, note: 'pressing the ' + grabbed.type + over + ' neither moved nor selected anything' }
    })
    if (type === 'geo' && shape.props && shape.props.fill !== 'none')
      await attempt('a click finds a filled geo', async () => {
        const hit = editor.getShapeAtPoint(boundsOf(shape).center, {
          margin: editor.options.hitTestMargin / editor.getZoomLevel(),
          hitInside: true,
          renderingOnly: true
        })
        return { ok: Boolean(hit) && hit.id === shape.id, note: hit ? 'found ' + hit.type : 'found nothing' }
      })
  }

  const box =
    shapes.find(
      shape =>
        (shape.type === 'design-node' || shape.type === 'note') &&
        editor.getShapeUtil(shape).canResize(shape) &&
        boundsOf(shape).w > 40 &&
        boundsOf(shape).h > 40
    ) || shapes.find(shape => editor.getShapeUtil(shape).canResize(shape))

  await attempt('a corner handle resizes', async () => {
    editor.select(box.id)
    await settle()
    const before = boundsOf(box)
    const corner = viewport({ x: before.maxX, y: before.maxY })
    await drag(corner, { x: corner.x + 50, y: corner.y + 40 })
    const after = boundsOf(box.id)
    return { ok: Math.abs(after.w - before.w) > 1 || Math.abs(after.h - before.h) > 1, note: Math.round(before.w) + 'x' + Math.round(before.h) + ' to ' + Math.round(after.w) + 'x' + Math.round(after.h) }
  })

  await attempt('shift keeps the ratio while resizing', async () => {
    editor.select(box.id)
    await settle()
    const before = boundsOf(box)
    const ratio = before.w / before.h
    const corner = viewport({ x: before.maxX, y: before.maxY })
    await drag(corner, { x: corner.x + 60, y: corner.y + 4 }, { modifiers: { shiftKey: true } })
    const after = boundsOf(box.id)
    if (Math.abs(after.w - before.w) < 1) return { ok: false, note: 'it did not resize at all' }
    return { ok: Math.abs(after.w / after.h - ratio) < 0.05, note: ratio.toFixed(3) + ' to ' + (after.w / after.h).toFixed(3) }
  })

  await attempt('the rotate handle rotates', async () => {
    editor.select(box.id)
    await settle()
    const before = editor.getShape(box.id).rotation
    const bounds = boundsOf(box)
    const outside = viewport({ x: bounds.minX, y: bounds.minY })
    await drag({ x: outside.x - 14, y: outside.y - 14 }, { x: outside.x + 50, y: outside.y - 50 })
    const after = editor.getShape(box.id).rotation
    if (after !== before) editor.updateShape({ id: box.id, type: box.type, rotation: before })
    return { ok: after !== before, note: before.toFixed(3) + ' to ' + after.toFixed(3) }
  })

  await attempt('undo and redo', async () => {
    editor.select(box.id)
    await settle()
    const start = editor.getShape(box.id).x
    editor.markHistoryStoppingPoint('board check')
    editor.updateShape({ id: box.id, type: box.type, x: start + 120 })
    await settle()
    editor.undo()
    await settle()
    const undone = editor.getShape(box.id).x
    editor.redo()
    await settle()
    const redone = editor.getShape(box.id).x
    editor.undo()
    await settle()
    return { ok: undone === start && redone === start + 120, note: 'undo ' + (undone === start) + ' redo ' + (redone === start + 120) }
  })

  await attempt('a marquee selects several', async () => {
    editor.selectNone()
    await settle()
    const all = editor.getCurrentPageBounds()
    await drag(viewport({ x: all.minX - 30, y: all.minY - 30 }), viewport(all.center))
    return { ok: editor.getSelectedShapeIds().length > 1, note: editor.getSelectedShapeIds().length + ' selected' }
  })

  await attempt('select all', async () => {
    editor.selectNone()
    press('a', { metaKey: true })
    await settle()
    return { ok: editor.getSelectedShapeIds().length > 1, note: editor.getSelectedShapeIds().length + ' selected' }
  })

  await attempt('escape clears the selection', async () => {
    editor.select(box.id)
    await settle()
    press('Escape')
    await settle()
    return { ok: editor.getSelectedShapeIds().length === 0 }
  })

  await attempt('an arrow key nudges', async () => {
    editor.select(box.id)
    await settle()
    const before = editor.getShape(box.id).x
    press('ArrowRight')
    await settle()
    const after = editor.getShape(box.id).x
    if (after !== before) editor.updateShape({ id: box.id, type: box.type, x: before })
    return { ok: after !== before, note: before.toFixed(1) + ' to ' + after.toFixed(1) }
  })

  await attempt('duplicate and delete', async () => {
    editor.select(box.id)
    await settle()
    const start = editor.getCurrentPageShapes().length
    press('d', { metaKey: true })
    await settle()
    const copied = editor.getCurrentPageShapes().length
    press('Delete')
    await settle()
    const left = editor.getCurrentPageShapes().length
    return { ok: copied > start && left < copied, note: start + ' to ' + copied + ' to ' + left }
  })

  await attempt('group and ungroup', async () => {
    const pair = editor
      .getCurrentPageShapes()
      .filter(shape => editor.getShapeParent(shape) === undefined || editor.getShapeParent(shape).typeName === 'page')
      .slice(0, 2)
      .map(shape => shape.id)
    if (pair.length < 2) return null
    editor.setSelectedShapes(pair)
    await settle()
    press('g', { metaKey: true })
    await settle()
    const grouped = editor.getCurrentPageShapes().some(shape => shape.type === 'group')
    press('g', { metaKey: true, shiftKey: true })
    await settle()
    const ungrouped = !editor.getCurrentPageShapes().some(shape => shape.type === 'group')
    return { ok: grouped && ungrouped, note: 'grouped ' + grouped + ' ungrouped ' + ungrouped }
  })

  for (const tool of ['design-node', 'note', 'frame', 'line', 'arrow', 'draw', 'highlight', 'text']) {
    await attempt('the ' + tool + ' tool draws', async () => {
      editor.selectNone()
      editor.setCurrentTool(tool)
      await settle()
      if (editor.getCurrentToolId() !== tool) return { ok: false, note: 'the tool did not take, still ' + editor.getCurrentToolId() }
      const start = editor.getCurrentPageShapes().length
      const centre = viewport(editor.getViewportPageBounds().center)
      await drag({ x: centre.x - 140, y: centre.y - 100 }, { x: centre.x - 20, y: centre.y - 10 })
      const made = editor.getCurrentPageShapes().length - start
      editor.setCurrentTool('select')
      await settle()
      if (made > 0) {
        editor.deleteShapes(editor.getCurrentPageShapes().slice(-made).map(shape => shape.id))
        await settle()
      }
      return { ok: made > 0, note: made + ' made' }
    })
  }

  await attempt('the hand tool pans', async () => {
    editor.setCurrentTool('hand')
    await settle()
    const before = editor.getCamera()
    const centre = viewport(editor.getViewportPageBounds().center)
    await drag(centre, { x: centre.x + 90, y: centre.y + 70 })
    const after = editor.getCamera()
    editor.setCurrentTool('select')
    return { ok: after.x !== before.x || after.y !== before.y }
  })

  await attempt('double click starts editing', async () => {
    const editable = oneOf('text') || oneOf('note') || oneOf('geo')
    if (!editable) return null
    editor.select(editable.id)
    await settle()
    const centre = viewport(boundsOf(editable).center)
    const onto = nodeOf(editable.id) || surface
    for (const round of [0, 1]) {
      pointer('pointerdown', centre.x, centre.y, 1, onto)
      await frame()
      pointer('pointerup', centre.x, centre.y, 0, onto)
      if (round === 0) await frame()
    }
    onto.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: centre.x, clientY: centre.y }))
    await settle(6)
    const editing = editor.getEditingShapeId()
    const caret = document.querySelector('[contenteditable="true"], textarea')
    return { ok: Boolean(editing) && Boolean(caret), note: 'editing ' + Boolean(editing) + ' caret ' + Boolean(caret) }
  })

  await attempt('typing reaches the shape', async () => {
    const id = editor.getEditingShapeId()
    if (!id) return { ok: false, note: 'nothing was being edited' }
    const caret = document.querySelector('[contenteditable="true"], textarea')
    if (!caret) return { ok: false, note: 'no caret to type into' }
    caret.focus()
    if (caret.tagName === 'TEXTAREA') {
      caret.value = caret.value + 'crewcheck'
      caret.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      caret.textContent = (caret.textContent || '') + 'crewcheck'
      caret.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }
    await settle(6)
    const written = JSON.stringify(editor.getShape(id).props.richText || editor.getShape(id).props.text || '')
    editor.setEditingShape(null)
    await settle()
    return { ok: written.includes('crewcheck'), note: written.slice(0, 80) }
  })

  await attempt('the wheel pans', async () => {
    const before = editor.getCamera()
    surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 }))
    await settle()
    return { ok: editor.getCamera().y !== before.y }
  })

  await attempt('ctrl and the wheel zooms', async () => {
    const before = editor.getZoomLevel()
    surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120, ctrlKey: true }))
    await settle()
    return { ok: editor.getZoomLevel() !== before, note: before.toFixed(3) + ' to ' + editor.getZoomLevel().toFixed(3) }
  })

  await attempt('hovering marks a shape', async () => {
    editor.selectNone()
    await settle()
    const shape = box
    const centre = viewport(boundsOf(shape).center)
    pointer('pointermove', centre.x, centre.y, 0, nodeOf(shape.id))
    await settle()
    const hovered = editor.getHoveredShapeId ? editor.getHoveredShapeId() : editor.getHoveredShape && editor.getHoveredShape()?.id
    return { ok: hovered === shape.id, note: 'hovered ' + hovered }
  })

  await attempt('snapping produces indicators', async () => {
    const two = shapes.slice(0, 2).map(shape => ({ id: shape.id, pageBounds: boundsOf(shape) }))
    if (two.length < 2) return null
    const one = two[0].pageBounds
    const other = two[1].pageBounds
    const snap = editor.snaps.snapTranslateBounds({
      initialSelectionPageBounds: one,
      dragDelta: { x: other.minX - one.minX + 5, y: other.minY - one.minY + 5 },
      snappableShapes: [two[1]],
      zoom: editor.getZoomLevel()
    })
    editor.snaps.setIndicators(snap.indicators)
    const active = editor.overlays.getOverlayUtil('snap_indicator').isActive() ? snap.indicators.length : 0
    editor.snaps.clearIndicators()
    return { ok: active > 0, note: active + ' indicators' }
  })

  await attempt('an arrow follows the shape it is bound to', async () => {
    const anchor = shapes.find(shape => shape.type === 'geo' || shape.type === 'design-node')
    if (!anchor) return null
    editor.setCurrentTool('arrow')
    await settle()
    if (editor.getCurrentToolId() !== 'arrow') return { ok: false, note: 'the arrow tool did not take' }
    const bounds = boundsOf(anchor)
    const from = viewport({ x: bounds.minX - 140, y: bounds.center.y })
    await drag(from, viewport(bounds.center))
    editor.setCurrentTool('select')
    await settle()
    const arrow = editor.getCurrentPageShapes().filter(shape => shape.type === 'arrow').pop()
    if (!arrow) return { ok: false, note: 'the arrow tool made nothing' }
    const bindings = editor.getBindingsFromShape(arrow.id, 'arrow')
    if (!bindings.length) {
      editor.deleteShapes([arrow.id])
      return { ok: false, note: 'the arrow did not bind to the shape under its end' }
    }
    const before = JSON.stringify(boundsOf(arrow.id))
    const anchorNow = editor.getShape(anchor.id)
    editor.updateShape({ id: anchor.id, type: anchorNow.type, x: anchorNow.x + 90 })
    await settle()
    const after = JSON.stringify(boundsOf(arrow.id))
    editor.updateShape({ id: anchor.id, type: anchorNow.type, x: anchorNow.x })
    editor.deleteShapes([arrow.id])
    await settle()
    return { ok: before !== after, note: before !== after ? 'it followed' : 'it stayed where it was' }
  })

  await attempt('the board exports to SVG', async () => {
    const exported = await editor.getSvgString(shapes.slice(0, 12).map(shape => shape.id), { padding: 0 })
    return { ok: Boolean(exported && exported.svg && exported.svg.includes('data-shape-id=')), note: exported && exported.svg ? exported.svg.length + ' characters' : 'nothing' }
  })

  return { checks, byType, records: shapes.length }
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
  await wait(800)
  let result = null
  try {
    result = await win.webContents.executeJavaScript(${JSON.stringify(driveSource)})
  } catch (error) {
    result = { failed: String((error && error.message) || error) }
  }
  const shot = await win.webContents.capturePage()
  console.log('BOARD ' + JSON.stringify({ ...result, pixels: !shot.isEmpty(), errors: [...new Set(errors)].slice(0, 12) }))
  app.exit(0)
}).catch(error => {
  console.log('BOARD ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

async function stage(file) {
  const saved = JSON.parse(await readFile(file, 'utf8'))
  if (!saved.document?.store || !saved.document?.schema) throw new Error(`${file} is not a Crew board`)
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-board-')))
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body><div id="root"></div></body></html>'
  )
  await writeFile(path.join(directory, 'probe.tsx'), probeSource(saved.document))
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
      reject(new Error('The board check did not finish'))
    }, 180_000)
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
  const result = await run(await compile(directory).then(() => directory))
  if (result.failed)
    throw new Error(`${result.failed}${result.errors?.length ? `\n${result.errors.join('\n')}` : ''}`)
  for (const check of result.checks) console.log(`${check.ok ? 'ok  ' : 'FAIL'}  ${check.name}${check.note ? `  (${check.note})` : ''}`)
  const problems = result.checks.filter(check => !check.ok).map(check => `${check.name}${check.note ? `: ${check.note}` : ''}`)
  if (!result.pixels) problems.push('the window captured no pixels')
  for (const error of result.errors) problems.push(`window error: ${error}`)
  console.log(
    `\n${path.basename(file)}, ${result.records} shapes: ${Object.entries(result.byType)
      .map(([type, count]) => `${type} ${count}`)
      .join(', ')}`
  )
  if (problems.length) throw new Error(`\n${problems.join('\n')}`)
  console.log(`all ${result.checks.length} checks passed`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
