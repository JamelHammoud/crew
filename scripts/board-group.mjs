import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { compile, probeSource, root, run } from './board-window.mjs'

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
    if (entry.isDirectory()) found.push(...(await boardsIn(target)))
    else if (
      entry.isFile() &&
      entry.name.endsWith('.json') &&
      target.includes(`${path.sep}.crew${path.sep}designs${path.sep}`)
    )
      found.push(target)
  }
  return found
}

async function groupedBoard() {
  if (process.env.CREW_BOARD_CHECK) return realpath(process.env.CREW_BOARD_CHECK)
  const projects = path.join(homedir(), 'Library', 'Application Support', 'Crew', 'projects')
  const files = await boardsIn(projects)
  const scored = []
  for (const file of files) {
    const saved = JSON.parse(await readFile(file, 'utf8'))
    const store = saved.document?.store ?? {}
    const groups = Object.values(store).filter(record => record.typeName === 'shape' && record.type === 'group')
    scored.push({ file, groups: groups.length })
  }
  const withGroups = scored.filter(one => one.groups > 0).sort((a, b) => b.groups - a.groups)
  if (withGroups.length === 0) throw new Error('No saved Crew board holds a group')
  return withGroups[0].file
}

const driveSource = String.raw`(async () => {
  const editor = window.canvasEditor
  if (!editor) return { failed: 'the editor never mounted' }
  const { availableCommands, shapesUnder } = window.designCommands
  const report = {}

  const surface = document.querySelector('[data-canvas="true"]')
  const overlay = document.querySelector('[data-canvas-overlays="true"]')
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const box = () => editor.getContainer().getBoundingClientRect()
  const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
  const settle = async (times = 4) => {
    for (let at = 0; at < times; at++) await frame()
  }
  const viewport = point => {
    const at = editor.pageToViewport(point)
    const rect = box()
    return { x: at.x + rect.left, y: at.y + rect.top }
  }
  const pageAt = at => {
    const rect = box()
    return editor.screenToPage({ x: at.x - rect.left, y: at.y - rect.top })
  }
  const pointer = (name, x, y, buttons, button, target) =>
    (target || surface).dispatchEvent(
      new PointerEvent(name, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button,
        buttons,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        pressure: buttons ? 0.5 : 0
      })
    )
  const leftClick = async (at, target) => {
    pointer('pointermove', at.x, at.y, 0, 0, target)
    await frame()
    pointer('pointerdown', at.x, at.y, 1, 0, target)
    pointer('pointerup', at.x, at.y, 0, 0, target)
    await settle()
  }
  const rightClick = async (at, target) => {
    pointer('pointermove', at.x, at.y, 0, 0, target)
    await frame()
    pointer('pointerdown', at.x, at.y, 2, 2, target)
    pointer('pointerup', at.x, at.y, 0, 2, target)
    ;(target || surface).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, button: 2 })
    )
    await settle()
  }
  const describe = id => {
    const shape = editor.getShape(id)
    if (!shape) return { id, missing: true }
    return { id, type: shape.type, parentId: shape.parentId }
  }
  const selection = () => editor.getSelectedShapeIds().map(describe)
  const round = value => Math.round(value * 100) / 100
  const boxOf = bounds =>
    bounds ? { x: round(bounds.x), y: round(bounds.y), w: round(bounds.w), h: round(bounds.h) } : null

  const group = editor.getCurrentPageShapes().find(shape => shape.type === 'group')
  if (!group) return { failed: 'the real board holds no group' }

  const childIds = editor.getSortedChildIdsForParent(group.id)
  report.group = {
    id: group.id,
    type: group.type,
    parentId: group.parentId,
    props: group.props,
    bounds: boxOf(editor.getShapePageBounds(group))
  }
  report.children = childIds.map(id => {
    const shape = editor.getShape(id)
    return { id, type: shape.type, parentId: shape.parentId, bounds: boxOf(editor.getShapePageBounds(shape)) }
  })

  const util = editor.getShapeUtil(group)
  report.util = {
    constructor: util?.constructor?.name ?? null,
    type: util?.constructor?.type ?? null,
    hideSelectionBoundsFg: typeof util?.hideSelectionBoundsFg === 'function' ? util.hideSelectionBoundsFg(group) : null,
    canResize: typeof util?.canResize === 'function' ? util.canResize(group) : null,
    hasGetIndicatorPath: typeof util?.getIndicatorPath === 'function',
    indicatorPathIsPath2D: (() => {
      try {
        return util.getIndicatorPath(group) instanceof Path2D
      } catch (error) {
        return 'threw: ' + (error && error.message)
      }
    })()
  }

  const geometry = editor.getShapeGeometry(group)
  report.geometry = {
    constructor: geometry?.constructor?.name ?? null,
    children: geometry?.children?.length ?? null,
    bounds: boxOf(geometry?.bounds)
  }

  editor.selectNone()
  editor.setCurrentTool('select')
  await settle()
  editor.zoomToBounds(editor.getShapePageBounds(group), { immediate: true, inset: 80 })
  await settle(8)
  report.zoom = round(editor.getZoomLevel())

  const hitMargin = editor.options.hitTestMargin / editor.getZoomLevel()
  const candidates = []
  for (const child of report.children) {
    if (!child.bounds) continue
    const shape = editor.getShape(child.id)
    const bounds = editor.getShapePageBounds(shape)
    const spots = [
      bounds.center,
      { x: bounds.center.x, y: bounds.minY + bounds.h * 0.25 },
      { x: bounds.minX + bounds.w * 0.25, y: bounds.center.y }
    ]
    for (const spot of spots) {
      const hit = editor.getShapeAtPoint(spot, {
        hitInside: false,
        hitLabels: true,
        margin: hitMargin,
        renderingOnly: true
      })
      const at = viewport(spot)
      const rect = box()
      const onScreen = at.x > rect.left + 8 && at.x < rect.right - 8 && at.y > rect.top + 8 && at.y < rect.bottom - 8
      if (hit && onScreen) {
        candidates.push({ child: child.id, hit: hit.id, hitType: hit.type, page: spot, screen: at })
        break
      }
    }
  }
  report.candidates = candidates.map(one => ({
    child: one.child,
    hit: one.hit,
    hitType: one.hitType,
    page: { x: round(one.page.x), y: round(one.page.y) }
  }))
  if (candidates.length === 0) return { ...report, failed: 'nothing inside the group hit tests on screen' }

  const spot = candidates.find(one => childIds.includes(one.hit)) ?? candidates[0]
  report.spot = {
    child: spot.child,
    hit: spot.hit,
    hitType: spot.hitType,
    page: { x: round(spot.page.x), y: round(spot.page.y) }
  }

  report.rawHit = (() => {
    const hit = editor.getShapeAtPoint(spot.page, {
      hitInside: false,
      hitLabels: true,
      margin: hitMargin,
      renderingOnly: true
    })
    if (!hit) return null
    const outermost = editor.getOutermostSelectableShape(hit)
    return {
      hit: hit.id + ' ' + hit.type,
      hitParent: hit.parentId,
      outermost: outermost.id + ' ' + outermost.type,
      focusedGroupId: editor.getFocusedGroupId(),
      currentPageId: editor.getCurrentPageId()
    }
  })()

  editor.selectNone()
  await settle()
  report.leftClickOnSurface = { before: selection() }
  await leftClick(spot.screen)
  report.leftClickOnSurface.after = selection()
  report.leftClickOnSurface.hovered = editor.getHoveredShape()?.id ?? null

  editor.selectNone()
  await settle()
  const childNode = nodeOf(spot.hit)
  report.leftClickOnShapeNode = { node: Boolean(childNode), before: selection() }
  await leftClick(spot.screen, childNode ?? undefined)
  report.leftClickOnShapeNode.after = selection()

  editor.selectNone()
  await settle()
  const beforeRight = selection()
  await rightClick(spot.screen, childNode ?? undefined)
  const afterRight = selection()
  report.rightClickFromNothing = { before: beforeRight, after: afterRight }

  const page = pageAt(spot.screen)
  const ctx = { editor, point: page, ask: () => {}, rename: () => {} }
  const ids = availableCommands(ctx).map(command => command.id)
  report.availableCommands = ids
  report.hasUngroup = ids.includes('ungroup')
  report.shapesUnder = shapesUnder(editor, page).map(shape => shape.type + ':' + shape.id)

  const bounds = editor.getShapePageBounds(group)
  const rightClickOptions = {
    margin: editor.options.hitTestMargin / editor.getZoomLevel(),
    hitInside: false,
    hitLabels: true,
    hitLocked: true,
    hitFrameInside: true,
    renderingOnly: true
  }
  const dead = []
  const alive = []
  const COLUMNS = 60
  const ROWS = 36
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      const point = {
        x: bounds.minX + (bounds.w * (column + 0.5)) / COLUMNS,
        y: bounds.minY + (bounds.h * (row + 0.5)) / ROWS
      }
      const hit = editor.getShapeAtPoint(point, rightClickOptions)
      if (hit) alive.push(point)
      else dead.push(point)
    }
  }
  report.deadZone = {
    sampled: COLUMNS * ROWS,
    hitsNothing: dead.length,
    hitsSomething: alive.length,
    share: round(dead.length / (COLUMNS * ROWS))
  }

  const onScreen = point => {
    const at = viewport(point)
    const frameBox = box()
    return at.x > frameBox.left + 16 && at.x < frameBox.right - 16 && at.y > frameBox.top + 16 && at.y < frameBox.bottom - 16
  }
  const deadSpot = dead.find(onScreen)
  if (deadSpot) {
    const deadScreen = viewport(deadSpot)
    report.deadSpot = { page: { x: round(deadSpot.x), y: round(deadSpot.y) } }

    editor.selectNone()
    await settle()
    await rightClick(deadScreen)
    const emptyIds = availableCommands({ ...ctx, point: pageAt(deadScreen) }).map(command => command.id)
    report.rightClickDeadFromNothing = {
      selection: selection(),
      hasUngroup: emptyIds.includes('ungroup'),
      shapesUnder: shapesUnder(editor, pageAt(deadScreen)).map(shape => shape.type + ':' + shape.id)
    }

    editor.selectNone()
    await settle()
    editor.setSelectedShapes([group.id])
    await settle()
    await rightClick(deadScreen)
    const heldIds = availableCommands({ ...ctx, point: pageAt(deadScreen) }).map(command => command.id)
    report.rightClickDeadWithGroupSelected = {
      selection: selection(),
      hasUngroup: heldIds.includes('ungroup')
    }
  }

  editor.selectNone()
  await settle()
  editor.setFocusedGroupId(group.id)
  editor.setSelectedShapes([spot.hit])
  await settle()
  const focusedIds = availableCommands({ ...ctx, point: pageAt(spot.screen) }).map(command => command.id)
  report.insideTheGroup = {
    focusedGroupId: editor.getFocusedGroupId(),
    selectionBeforeRightClick: selection(),
    hasUngroupBeforeRightClick: focusedIds.includes('ungroup')
  }
  await rightClick(spot.screen, childNode ?? undefined)
  const afterFocusedIds = availableCommands({ ...ctx, point: pageAt(spot.screen) }).map(command => command.id)
  report.insideTheGroup.selectionAfterRightClick = selection()
  report.insideTheGroup.hasUngroupAfterRightClick = afterFocusedIds.includes('ungroup')
  editor.setFocusedGroupId(editor.getCurrentPageId())
  await settle()

  await rightClick(spot.screen, childNode ?? undefined)
  const afterSecond = selection()
  const secondIds = availableCommands({ ...ctx, point: pageAt(spot.screen) }).map(command => command.id)
  report.rightClickAgain = { after: afterSecond, commands: secondIds, hasUngroup: secondIds.includes('ungroup') }

  editor.selectNone()
  await settle()
  editor.setSelectedShapes([group.id])
  await settle()
  const forcedIds = availableCommands(ctx).map(command => command.id)
  report.forcedGroupSelection = {
    selection: selection(),
    hasUngroup: forcedIds.includes('ungroup'),
    commands: forcedIds
  }

  const rect = box()
  pointer('pointermove', rect.left + 4, rect.bottom - 4, 0, 0)
  await settle(6)
  report.paintedWith = { selection: selection(), hovered: editor.getHoveredShape()?.id ?? null }

  const painted = (() => {
    if (!overlay) return { failed: 'no overlay canvas' }
    const context = overlay.getContext('2d')
    const data = context.getImageData(0, 0, overlay.width, overlay.height)
    const dpr = overlay.width / rect.width
    const pixels = data.data
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let count = 0
    for (let y = 0; y < overlay.height; y++) {
      for (let x = 0; x < overlay.width; x++) {
        if (pixels[(y * overlay.width + x) * 4 + 3] > 24) {
          count += 1
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (count === 0) return { pixels: 0 }
    const toPage = (x, y) => editor.screenToPage({ x: x / dpr, y: y / dpr })
    const topLeft = toPage(minX, minY)
    const bottomRight = toPage(maxX, maxY)
    const at = (x, y) => pixels[(Math.round(y) * overlay.width + Math.round(x)) * 4 + 3] > 24
    const near = (x, y, radius) => {
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const px = Math.round(x + dx)
          const py = Math.round(y + dy)
          if (px < 0 || py < 0 || px >= overlay.width || py >= overlay.height) continue
          if (at(px, py)) return true
        }
      return false
    }
    const deviceOf = point => {
      const view = editor.pageToViewport(point)
      return { x: view.x * dpr, y: view.y * dpr }
    }

    const bounds = editor.getShapePageBounds(group)
    const corners = [
      { name: 'top_left', x: bounds.minX, y: bounds.minY },
      { name: 'top_right', x: bounds.maxX, y: bounds.minY },
      { name: 'bottom_left', x: bounds.minX, y: bounds.maxY },
      { name: 'bottom_right', x: bounds.maxX, y: bounds.maxY }
    ].map(corner => {
      const device = deviceOf(corner)
      let filled = 0
      const half = Math.round(5 * dpr)
      for (let dy = -half; dy <= half; dy++)
        for (let dx = -half; dx <= half; dx++) {
          const px = Math.round(device.x + dx)
          const py = Math.round(device.y + dy)
          if (px < 0 || py < 0 || px >= overlay.width || py >= overlay.height) continue
          if (at(px, py)) filled += 1
        }
      return { handle: corner.name, litPixels: filled, of: (half * 2 + 1) ** 2 }
    })

    const walk = (from, to) => {
      const a = deviceOf(from)
      const b = deviceOf(to)
      const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y)))
      let lit = 0
      let runs = 0
      let was = false
      for (let step = 0; step <= steps; step++) {
        const x = a.x + ((b.x - a.x) * step) / steps
        const y = a.y + ((b.y - a.y) * step) / steps
        const on = near(x, y, Math.max(1, Math.round(dpr)))
        if (on) lit += 1
        if (on && !was) runs += 1
        was = on
      }
      return { samples: steps + 1, lit, runs, coverage: round(lit / (steps + 1)) }
    }

    const edges = {
      groupTop: walk({ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY }),
      groupLeft: walk({ x: bounds.minX, y: bounds.minY }, { x: bounds.minX, y: bounds.maxY })
    }

    const childEdges = childIds.map(id => {
      const shape = editor.getShape(id)
      const kid = editor.getShapePageBounds(shape)
      if (!kid) return { id, skipped: 'no bounds' }
      const inset = 6 / editor.getZoomLevel()
      const ownTop = kid.minY > bounds.minY + inset && kid.minY < bounds.maxY - inset
      const ownLeft = kid.minX > bounds.minX + inset && kid.minX < bounds.maxX - inset
      const result = { id, type: shape.type }
      if (ownTop) result.top = walk({ x: kid.minX, y: kid.minY }, { x: kid.maxX, y: kid.minY })
      if (ownLeft) result.left = walk({ x: kid.minX, y: kid.minY }, { x: kid.minX, y: kid.maxY })
      if (!ownTop && !ownLeft) result.skipped = 'edges sit on the group edge'
      return result
    })

    return {
      pixels: count,
      paintedPageBox: {
        x: round(topLeft.x),
        y: round(topLeft.y),
        w: round(bottomRight.x - topLeft.x),
        h: round(bottomRight.y - topLeft.y)
      },
      groupPageBox: boxOf(bounds),
      corners,
      edges,
      childEdges
    }
  })()
  report.painted = painted

  const overlays = editor.overlays?.getOverlays?.() ?? []
  report.overlays = overlays.map(one => one.type + ':' + one.id)

  return report
})()`

const mainSource = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const errors = []
  const win = new BrowserWindow({ width: 1400, height: 900, show: true, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) errors.push(String(message).slice(0, 240))
  })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  for (let at = 0; at < 200; at++) {
    const ready = await win.webContents.executeJavaScript('Boolean(window.canvasReady)').catch(() => false)
    if (ready) break
    await wait(50)
  }
  await wait(1500)
  let result = null
  try {
    result = await win.webContents.executeJavaScript(${JSON.stringify(driveSource)})
  } catch (error) {
    result = { failed: String((error && error.stack) || error) }
  }
  const shot = await win.webContents.capturePage()
  console.log('GROUP ' + JSON.stringify({ ...result, pixels: !shot.isEmpty(), errors: [...new Set(errors)].slice(0, 12) }))
  app.exit(0)
}).catch(error => {
  console.log('GROUP ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

async function stageWithCommands(file, main) {
  const saved = JSON.parse(await readFile(file, 'utf8'))
  if (!saved.document?.store || !saved.document?.schema) throw new Error(`${file} is not a Crew board`)
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-group-')))
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body><div id="root"></div></body></html>'
  )
  const commands = JSON.stringify(path.join(root, 'src/renderer/src/design/commands.ts'))
  await writeFile(
    path.join(directory, 'probe.tsx'),
    `${probeSource(saved.document)}
import { availableCommands as probeAvailableCommands, shapesUnder as probeShapesUnder, DESIGN_COMMANDS as PROBE_COMMANDS } from ${commands}
window.designCommands = {
  availableCommands: probeAvailableCommands,
  shapesUnder: probeShapesUnder,
  all: PROBE_COMMANDS.map(command => command.id)
}
`
  )
  await writeFile(
    path.join(directory, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@import "${path.join(root, 'src/renderer/src/canvas/canvas.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n#root { position: relative; }\n`
  )
  await writeFile(path.join(directory, 'main.cjs'), main)
  return directory
}

const file = await groupedBoard()
const directory = await stageWithCommands(file, mainSource)
try {
  const result = await run(await compile(directory), 'GROUP')
  console.log(path.basename(file))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await rm(directory, { recursive: true, force: true })
}
