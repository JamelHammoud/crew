import { rm } from 'node:fs/promises'
import path from 'node:path'
import { boardFile, compile, run, stage } from './board-window.mjs'

const driveSource = String.raw`(async () => {
  const editor = window.canvasEditor
  if (!editor) return { failed: 'the editor never mounted' }
  const probe = window.__probe
  const checks = []
  let section = 'The board'
  const say = (name, ok, note) =>
    checks.push({ section, name, ok: Boolean(ok), note: note === undefined ? '' : String(note) })
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
  const round = value => Math.round(value * 100) / 100
  const near = (one, other, slack) => Math.abs(one - other) <= (slack === undefined ? 1.5 : slack)

  const surface = document.querySelector('[data-canvas="true"]')
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const box = () => editor.getContainer().getBoundingClientRect()
  const viewport = point => {
    const at = editor.pageToViewport(point)
    const rect = box()
    return { x: at.x + rect.left, y: at.y + rect.top }
  }
  const inCanvas = at => {
    const rect = box()
    return { x: at.x + rect.left, y: at.y + rect.top }
  }
  const pageAt = at => {
    const rect = box()
    return editor.screenToPage({ x: at.x - rect.left, y: at.y - rect.top })
  }
  const stillCamera = async (times = 20) => {
    for (let at = 0; at < times && editor.getCameraState() === 'moving'; at++) await frame()
    return editor.getCameraState()
  }
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
    const steps = settings.steps || 6
    pointer('pointerdown', from.x, from.y, 1, settings.target, settings.modifiers)
    await frame()
    for (let step = 1; step <= steps; step++) {
      pointer(
        'pointermove',
        from.x + ((to.x - from.x) * step) / steps,
        from.y + ((to.y - from.y) * step) / steps,
        1,
        undefined,
        settings.modifiers
      )
      await frame()
    }
    pointer('pointerup', to.x, to.y, 0, undefined, settings.modifiers)
    await settle()
  }
  const click = async (at, options) => {
    const settings = options || {}
    pointer('pointerdown', at.x, at.y, 1, settings.target, settings.modifiers)
    pointer('pointerup', at.x, at.y, 0, settings.target, settings.modifiers)
    await settle()
  }
  const doubleClick = async (at, target) => {
    const onto = target || surface
    for (const tap of [0, 1]) {
      pointer('pointerdown', at.x, at.y, 1, onto)
      await frame()
      pointer('pointerup', at.x, at.y, 0, onto)
      if (tap === 0) await frame()
    }
    onto.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y }))
    await settle(6)
  }
  const boundsOf = shape => editor.getShapePageBounds(shape)
  const restore = async (shape, before) => {
    editor.updateShape({ id: shape.id, type: shape.type, x: before.x, y: before.y, rotation: before.rotation })
    await frame()
  }
  const selection = () => editor.getSelectedShapeIds().slice().sort().join(',')
  const same = (one, other) => one.slice().sort().join(',') === other.slice().sort().join(',')

  const handleAt = name => {
    const util = editor.overlays.getOverlayUtil('selection_foreground')
    if (!util.isActive()) return null
    const found = (util.getOverlays() || []).find(item => item.id === 'selection:' + name)
    return found ? found.props.point : null
  }
  const overlayAt = page => {
    const found = editor.overlays.getOverlayAtPoint(page, editor.options.hitTestMargin / editor.getZoomLevel())
    if (!found) return 'nothing'
    return (found.props && found.props.handle) || found.type
  }

  let counter = 0
  const nextId = () => 'shape:probe-' + ++counter
  const startBounds = editor.getCurrentPageBounds()
  const home = { x: Math.round(startBounds ? startBounds.maxX + 4000 : 4000), y: Math.round(startBounds ? startBounds.minY : 0) }
  const look = (page, at, zoom) =>
    editor.setCamera({ x: at.x / zoom - page.x, y: at.y / zoom - page.y, z: zoom }, { immediate: true })
  const empty = () => inCanvas({ x: 70, y: 70 })

  const made = []
  const build = (type, at, props, parentId) => {
    const id = nextId()
    made.push(id)
    editor.createShape({
      id,
      type,
      parentId,
      x: home.x + at.x,
      y: home.y + at.y,
      props: props || {}
    })
    return id
  }
  const clear = async () => {
    editor.setEditingShape(null)
    editor.setCurrentTool('select.idle')
    await frame()
    const alive = made.splice(0, made.length).filter(id => editor.getShape(id) !== undefined)
    if (alive.length) editor.deleteShapes(alive)
    editor.selectNone()
    await settle()
  }
  const scratch = async () => {
    editor.setEditingShape(null)
    editor.setCurrentTool('select.idle')
    editor.selectNone()
    look(home, { x: 220, y: 200 }, 1)
    await settle()
  }
  const rect = (at, size, props) =>
    build('design-node', at, { w: size.w, h: size.h, shape: 'rect', name: 'Probe', ...(props || {}) })

  const shapes = editor.getCurrentPageShapesSorted()
  const byType = {}
  for (const shape of shapes) byType[shape.type] = (byType[shape.type] || 0) + 1
  const present = Object.keys(byType)
  const oneOf = type => shapes.find(shape => shape.type === type)
  const painted = document.querySelectorAll('[data-canvas-shape="true"]').length

  say('shapes painted', painted === shapes.length, painted + ' of ' + shapes.length)
  if (byType.draw) say('draw paths painted', Boolean(document.querySelector('[data-shape-type="draw"] path')))
  if (byType.text || byType.note || byType.geo)
    say(
      'rich text painted',
      document.querySelectorAll('.crew-rich-text').length > 0,
      document.querySelectorAll('.crew-rich-text').length + ' runs'
    )
  say('no retired canvas terms', !document.documentElement.innerHTML.toLowerCase().includes('tld' + 'raw'))
  say('the inspector stands beside the board', Boolean(document.querySelector('[data-probe-panel]')))

  await attempt('the checks aim where they mean to', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    const centre = boundsOf(one).center
    const at = viewport(centre)
    const back = pageAt(at)
    const under = document.elementFromPoint(at.x, at.y)
    const painted = under && under.closest ? under.closest('[data-canvas-shape="true"]') : null
    const landed = painted ? painted.getAttribute('data-shape-id') : 'nothing painted'
    await clear()
    return {
      ok: near(back.x, centre.x, 1) && near(back.y, centre.y, 1) && landed === one,
      note:
        'a point ' +
        round(centre.x) +
        ',' +
        round(centre.y) +
        ' on the board reads back as ' +
        round(back.x) +
        ',' +
        round(back.y) +
        ' and the window draws ' +
        (landed === one ? 'that shape there' : landed + ' there')
    }
  })

  section = 'Selecting'

  await attempt('a click selects one', async () => {
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    rect({ x: 200, y: 0 }, { w: 120, h: 90 })
    await settle()
    await click(viewport(boundsOf(one).center))
    const got = editor.getSelectedShapeIds()
    return { ok: got.length === 1 && got[0] === one, note: got.length + ' selected' }
  })

  await attempt('shift click adds and takes away', async () => {
    const [one, two] = made
    editor.selectNone()
    await settle()
    await click(viewport(boundsOf(one).center))
    const first = editor.getSelectedShapeIds()
    await click(viewport(boundsOf(two).center), { modifiers: { shiftKey: true } })
    const both = editor.getSelectedShapeIds()
    await click(viewport(boundsOf(one).center), { modifiers: { shiftKey: true } })
    const left = editor.getSelectedShapeIds()
    return {
      ok: same(first, [one]) && same(both, [one, two]) && same(left, [two]),
      note: first.length + ' then ' + both.length + ' then ' + left.length
    }
  })

  await attempt('a click on empty canvas clears', async () => {
    editor.setSelectedShapes(made.slice())
    await settle()
    await click(empty())
    return { ok: editor.getSelectedShapeIds().length === 0, note: editor.getSelectedShapeIds().length + ' left' }
  })

  await attempt('a marquee from empty canvas selects what it covers', async () => {
    editor.selectNone()
    await settle()
    const all = made.map(id => boundsOf(id)).reduce((box, one) => ({
      minX: Math.min(box.minX, one.minX),
      minY: Math.min(box.minY, one.minY),
      maxX: Math.max(box.maxX, one.maxX),
      maxY: Math.max(box.maxY, one.maxY)
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
    const from = empty()
    const to = viewport({ x: all.maxX + 20, y: all.maxY + 20 })
    await drag(from, to)
    return { ok: same(editor.getSelectedShapeIds(), made), note: editor.getSelectedShapeIds().length + ' selected' }
  })

  await attempt('a marquee with shift adds to the selection', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 100, h: 80 })
    const two = rect({ x: 160, y: 0 }, { w: 100, h: 80 })
    const three = rect({ x: 320, y: 0 }, { w: 100, h: 80 })
    await settle()
    editor.select(three)
    await settle()
    const from = empty()
    const to = viewport({ x: boundsOf(two).maxX + 10, y: boundsOf(two).maxY + 10 })
    await drag(from, to, { modifiers: { shiftKey: true } })
    return { ok: same(editor.getSelectedShapeIds(), [one, two, three]), note: editor.getSelectedShapeIds().length + ' selected' }
  })

  await attempt('a click reaches a shape inside a frame', async () => {
    await clear()
    await scratch()
    const frameId = build('frame', { x: 0, y: 0 }, { w: 300, h: 220, name: 'Probe frame' })
    const childId = nextId()
    made.push(childId)
    editor.createShape({ id: childId, type: 'design-node', parentId: frameId, x: 60, y: 50, props: { w: 120, h: 90, shape: 'rect', name: 'Inside' } })
    await settle()
    editor.selectNone()
    await settle()
    await click(viewport(boundsOf(childId).center))
    const got = editor.getSelectedShapeIds()
    return { ok: same(got, [childId]), note: got.length === 1 ? 'selected the ' + editor.getShape(got[0]).type : got.length + ' selected' }
  })

  await attempt('a group takes the click and a double click reaches inside', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    const two = rect({ x: 200, y: 0 }, { w: 120, h: 90 })
    await settle()
    editor.setSelectedShapes([one, two])
    editor.groupShapes([one, two])
    await settle()
    const group = editor.getShapeParent(one)
    if (!group || group.type !== 'group') return { ok: false, note: 'the group was never made' }
    made.push(group.id)
    editor.selectNone()
    await settle()
    const at = viewport(boundsOf(one).center)
    await click(at)
    const outer = editor.getSelectedShapeIds()
    await doubleClick(at, nodeOf(one) || surface)
    const inner = editor.getSelectedShapeIds()
    return {
      ok: same(outer, [group.id]) && same(inner, [one]),
      note: 'click ' + (same(outer, [group.id]) ? 'the group' : outer.length + ' shapes') + ', double click ' + (same(inner, [one]) ? 'the shape inside' : inner.length + ' shapes')
    }
  })

  await attempt('the selection survives a zoom and a pan', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    const two = rect({ x: 200, y: 0 }, { w: 120, h: 90 })
    await settle()
    editor.setSelectedShapes([one, two])
    await settle()
    const before = selection()
    surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -240, ctrlKey: true }))
    await settle()
    const zoomed = selection()
    surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 200 }))
    await settle()
    const panned = selection()
    return { ok: before === zoomed && before === panned, note: 'zoom ' + (before === zoomed) + ' pan ' + (before === panned) }
  })

  await attempt('nothing floats over the middle of a selected shape', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle()
    const middle = overlayAt(boundsOf(one).center)
    const inside = overlayAt({ x: boundsOf(one).minX + 30, y: boundsOf(one).minY + 30 })
    return {
      ok: middle === 'nothing' && inside === 'nothing',
      note: 'the middle answers as ' + middle + ', a corner of the inside as ' + inside
    }
  })

  await attempt('a selected shape draws an outline', async () => {
    const one = made[0]
    const util = editor.overlays.getOverlayUtil('shape_indicator')
    const marks = util.isActive() ? util.getOverlays() : []
    const outlined = marks.reduce((all, mark) => all.concat(mark.props.indicated || []), [])
    return { ok: outlined.includes(one), note: outlined.length + ' outlined, ' + (util.isActive() ? 'drawing' : 'standing down') }
  })

  await attempt('a click still lands at a fitted zoom', async () => {
    await clear()
    editor.selectNone()
    editor.zoomToFit({ immediate: true })
    await settle()
    const zoom = editor.getZoomLevel()
    const target = shapes
      .filter(shape => {
        const bounds = boundsOf(shape)
        if (!bounds || bounds.w * zoom < 24 || bounds.h * zoom < 24) return false
        const hit = editor.getShapeAtPoint(bounds.center, { margin: 0, hitInside: true, renderingOnly: true })
        return hit && hit.id === shape.id
      })
      .pop()
    if (!target) return null
    await click(viewport(boundsOf(target).center))
    const got = editor.getSelectedShapeIds()
    return { ok: same(got, [target.id]), note: 'at zoom ' + round(zoom) + ', ' + got.length + ' selected' }
  })

  section = 'Dragging'

  await attempt('a drag moves a shape by what the pointer travelled', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    await settle()
    editor.select(one)
    await settle()
    const before = boundsOf(one)
    const at = viewport(before.center)
    await drag(at, { x: at.x + 90, y: at.y + 60 })
    const after = boundsOf(one)
    return {
      ok: near(after.minX - before.minX, 90, 2) && near(after.minY - before.minY, 60, 2),
      note: 'moved ' + round(after.minX - before.minX) + ' by ' + round(after.minY - before.minY)
    }
  })

  await attempt('a drag moves a whole multi selection', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    const two = rect({ x: 200, y: 0 }, { w: 120, h: 90 })
    await settle()
    editor.setSelectedShapes([one, two])
    await settle()
    const first = boundsOf(one)
    const second = boundsOf(two)
    const at = viewport(first.center)
    await drag(at, { x: at.x + 70, y: at.y + 40 })
    const movedOne = boundsOf(one).minX - first.minX
    const movedTwo = boundsOf(two).minX - second.minX
    return {
      ok: near(movedOne, 70, 2) && near(movedTwo, 70, 2) && near(boundsOf(two).minY - second.minY, 40, 2),
      note: 'one moved ' + round(movedOne) + ', the other ' + round(movedTwo)
    }
  })

  await attempt('a drag takes a shape out of a frame', async () => {
    await clear()
    await scratch()
    const frameId = build('frame', { x: 0, y: 0 }, { w: 280, h: 200, name: 'Probe frame' })
    const childId = nextId()
    made.push(childId)
    editor.createShape({ id: childId, type: 'design-node', parentId: frameId, x: 40, y: 40, props: { w: 100, h: 80, shape: 'rect', name: 'Inside' } })
    await settle()
    editor.select(childId)
    await settle()
    const at = viewport(boundsOf(childId).center)
    await drag(at, { x: at.x + 460, y: at.y + 40 })
    const parent = editor.getShapeParent(childId)
    return { ok: !parent || parent.type !== 'frame', note: 'parent is ' + (parent ? parent.type : 'the page') }
  })

  await attempt('a drag puts a shape into a frame', async () => {
    await clear()
    await scratch()
    const frameId = build('frame', { x: 0, y: 0 }, { w: 280, h: 200, name: 'Probe frame' })
    const loose = rect({ x: 420, y: 20 }, { w: 100, h: 80 })
    await settle()
    editor.select(loose)
    await settle()
    const at = viewport(boundsOf(loose).center)
    const onto = viewport(boundsOf(frameId).center)
    await drag(at, onto, { steps: 10 })
    const parent = editor.getShapeParent(loose)
    return { ok: Boolean(parent) && parent.id === frameId, note: 'parent is ' + (parent ? parent.type : 'the page') }
  })

  await attempt('a drag lands on a snap', async () => {
    await clear()
    await scratch()
    const anchor = rect({ x: 0, y: 0 }, { w: 140, h: 100 })
    const mover = rect({ x: 0, y: 220 }, { w: 140, h: 100 })
    await settle()
    editor.select(mover)
    await settle()
    const anchorLeft = boundsOf(anchor).minX
    const before = boundsOf(mover)
    const at = viewport(before.center)
    await drag(at, { x: at.x + 6, y: at.y }, { steps: 8 })
    const after = boundsOf(mover)
    return {
      ok: near(after.minX, anchorLeft, 1.5),
      note: 'dragged 6 across, left edge landed ' + round(after.minX - anchorLeft) + ' from the one above it'
    }
  })

  await attempt('a drag works while scrolled and zoomed', async () => {
    await clear()
    editor.setCurrentTool('select')
    editor.selectNone()
    look(home, { x: 300, y: 260 }, 0.42)
    await settle()
    const one = rect({ x: 0, y: 0 }, { w: 300, h: 240 })
    await settle()
    editor.select(one)
    await settle()
    const zoom = editor.getZoomLevel()
    const before = boundsOf(one)
    const at = viewport(before.center)
    await drag(at, { x: at.x + 120, y: at.y + 80 })
    const after = boundsOf(one)
    return {
      ok: near(after.minX - before.minX, 120 / zoom, 3) && near(after.minY - before.minY, 80 / zoom, 3),
      note: 'at zoom ' + round(zoom) + ', moved ' + round(after.minX - before.minX) + ' where ' + round(120 / zoom) + ' was asked for'
    }
  })

  section = 'Resizing'

  await attempt('a selected shape wears all twelve handles', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle()
    const util = editor.overlays.getOverlayUtil('selection_foreground')
    const handles = util.isActive() ? util.getOverlays().map(item => item.props.handle) : []
    return {
      ok: handles.length === 12,
      note: handles.length + ' handles on a 200 by 160 shape at zoom ' + round(editor.getZoomLevel())
    }
  })

  await attempt('the handles collapse on a shape too small to grab', async () => {
    await clear()
    editor.setCurrentTool('select.idle')
    look(home, { x: 300, y: 260 }, 0.05)
    await settle()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle()
    const util = editor.overlays.getOverlayUtil('selection_foreground')
    const handles = util.isActive() ? util.getOverlays().map(item => item.props.handle) : []
    const turns = handles.filter(handle => handle.endsWith('_rotate'))
    return {
      ok: turns.length === 0 && handles.length < 12,
      note: handles.length + ' handles and ' + turns.length + ' of them rotate, on a shape ' + round(200 * editor.getZoomLevel()) + ' across the screen'
    }
  })

  const EDGES = [
    { handle: 'top_left', by: { x: -40, y: -30 }, moves: ['minX', 'minY'] },
    { handle: 'top', by: { x: 0, y: -30 }, moves: ['minY'] },
    { handle: 'top_right', by: { x: 40, y: -30 }, moves: ['maxX', 'minY'] },
    { handle: 'right', by: { x: 40, y: 0 }, moves: ['maxX'] },
    { handle: 'bottom_right', by: { x: 40, y: 30 }, moves: ['maxX', 'maxY'] },
    { handle: 'bottom', by: { x: 0, y: 30 }, moves: ['maxY'] },
    { handle: 'bottom_left', by: { x: -40, y: 30 }, moves: ['minX', 'maxY'] },
    { handle: 'left', by: { x: -40, y: 0 }, moves: ['minX'] }
  ]

  for (const edge of EDGES) {
    await attempt('the ' + edge.handle.replace('_', ' ') + ' handle resizes', async () => {
      await clear()
      await scratch()
      const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
      await settle()
      editor.select(one)
      await settle()
      const before = boundsOf(one)
      const grip = handleAt(edge.handle)
      if (!grip) return { ok: false, note: 'the board draws no ' + edge.handle + ' handle' }
      const at = viewport(grip)
      await drag(at, { x: at.x + edge.by.x, y: at.y + edge.by.y })
      const after = boundsOf(one)
      const wrong = []
      for (const side of ['minX', 'minY', 'maxX', 'maxY']) {
        const wanted = edge.moves.includes(side) ? before[side] + (side.endsWith('X') ? edge.by.x : edge.by.y) : before[side]
        if (!near(after[side], wanted, 2)) wrong.push(side + ' ' + round(after[side] - wanted) + ' out')
      }
      return {
        ok: wrong.length === 0,
        note: wrong.length ? wrong.join(', ') + ' (found ' + overlayAt(grip) + ' under the grip)' : round(before.w) + 'x' + round(before.h) + ' to ' + round(after.w) + 'x' + round(after.h)
      }
    })
  }

  await attempt('shift keeps the ratio while resizing', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 100 })
    await settle()
    editor.select(one)
    await settle()
    const before = boundsOf(one)
    const grip = viewport(handleAt('bottom_right'))
    await drag(grip, { x: grip.x + 80, y: grip.y + 4 }, { modifiers: { shiftKey: true } })
    const after = boundsOf(one)
    if (near(after.w, before.w, 1)) return { ok: false, note: 'it did not resize at all' }
    return { ok: Math.abs(after.w / after.h - before.w / before.h) < 0.05, note: round(before.w / before.h) + ' to ' + round(after.w / after.h) }
  })

  await attempt('alt resizes from the centre', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle()
    const before = boundsOf(one)
    const grip = viewport(handleAt('bottom_right'))
    await drag(grip, { x: grip.x + 50, y: grip.y + 40 }, { modifiers: { altKey: true } })
    const after = boundsOf(one)
    return {
      ok: near(after.center.x, before.center.x, 2) && near(after.center.y, before.center.y, 2) && near(after.w - before.w, 100, 3),
      note: 'centre moved ' + round(after.center.x - before.center.x) + ', width grew ' + round(after.w - before.w)
    }
  })

  for (const axis of ['x', 'y']) {
    await attempt('resizing flips through zero on ' + axis, async () => {
      await clear()
      await scratch()
      const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
      await settle()
      editor.select(one)
      await settle()
      const before = boundsOf(one)
      const grip = viewport(handleAt(axis === 'x' ? 'right' : 'bottom'))
      const to = axis === 'x' ? { x: grip.x - 260, y: grip.y } : { x: grip.x, y: grip.y - 220 }
      await drag(grip, to, { steps: 10 })
      const after = boundsOf(one)
      const props = editor.getShape(one).props
      const flipped = axis === 'x' ? after.maxX < before.minX + 2 : after.maxY < before.minY + 2
      return {
        ok: flipped && props.w > 0 && props.h > 0 && after.w > 10 && after.h > 10,
        note: 'flipped ' + flipped + ', box ' + round(after.w) + 'x' + round(after.h) + ', props ' + round(props.w) + 'x' + round(props.h)
      }
    })
  }

  await attempt('a multi selection resizes together', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 100 })
    const two = rect({ x: 200, y: 0 }, { w: 120, h: 100 })
    await settle()
    editor.setSelectedShapes([one, two])
    await settle()
    const before = editor.getSelectionPageBounds()
    const firstBefore = boundsOf(one)
    const grip = viewport(handleAt('bottom_right'))
    await drag(grip, { x: grip.x + 160, y: grip.y + 100 })
    const after = editor.getSelectionPageBounds()
    const firstAfter = boundsOf(one)
    return {
      ok: near(after.w - before.w, 160, 4) && firstAfter.w > firstBefore.w + 10,
      note: 'the pair grew ' + round(after.w - before.w) + ', the first grew ' + round(firstAfter.w - firstBefore.w)
    }
  })

  await attempt('a rotated shape resizes along its own axis', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 140 })
    editor.updateShape({ id: one, type: 'design-node', rotation: 0.5 })
    await settle()
    editor.select(one)
    await settle()
    const before = editor.getShape(one).props
    const grip = handleAt('right')
    if (!grip) return { ok: false, note: 'no right handle on a rotated shape' }
    const at = viewport(grip)
    const to = { x: at.x + Math.cos(0.5) * 60, y: at.y + Math.sin(0.5) * 60 }
    await drag(at, to)
    const after = editor.getShape(one)
    return {
      ok: near(after.props.w - before.w, 60, 4) && near(after.rotation, 0.5, 0.01) && near(after.props.h, before.h, 2),
      note: 'width grew ' + round(after.props.w - before.w) + ', height moved ' + round(after.props.h - before.h) + ', rotation ' + round(after.rotation)
    }
  })

  section = 'Rotating'

  for (const corner of ['top_left_rotate', 'top_right_rotate', 'bottom_right_rotate', 'bottom_left_rotate']) {
    await attempt('the ' + corner.replace(/_/g, ' ') + ' handle turns the shape', async () => {
      await clear()
      await scratch()
      const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
      await settle()
      editor.select(one)
      await settle()
      const grip = handleAt(corner)
      if (!grip) return { ok: false, note: 'the board draws no ' + corner }
      const found = overlayAt(grip)
      const centre = boundsOf(one).center
      const at = viewport(grip)
      const away = viewport({ x: centre.x + (grip.x - centre.x) * 1.4, y: centre.y + (grip.y - centre.y) * 0.2 })
      await drag(at, away, { steps: 10 })
      const after = editor.getShape(one).rotation
      return {
        ok: Math.abs(after) > 0.05,
        note: after === 0 ? 'it did not turn, and the point the board puts the handle at answers as ' + found : 'turned to ' + round(after) + ' radians'
      }
    })
  }

  await attempt('shift snaps the turn to fifteen degrees', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle()
    const grip = handleAt('top_left_rotate')
    if (!grip) return { ok: false, note: 'no rotate handle to grab' }
    const at = viewport(grip)
    await drag(at, { x: at.x + 130, y: at.y - 37 }, { steps: 10, modifiers: { shiftKey: true } })
    const after = editor.getShape(one).rotation
    const step = Math.PI / 12
    const off = Math.abs(after / step - Math.round(after / step))
    return { ok: Math.abs(after) > 0.01 && off < 0.02, note: round(after) + ' radians, ' + round((after * 180) / Math.PI) + ' degrees' }
  })

  await attempt('a multi selection turns about its common centre', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 100 })
    const two = rect({ x: 220, y: 60 }, { w: 120, h: 100 })
    await settle()
    editor.setSelectedShapes([one, two])
    await settle()
    const before = editor.getSelectionPageBounds().center
    const grip = handleAt('top_left_rotate')
    if (!grip) return { ok: false, note: 'no rotate handle to grab' }
    const at = viewport(grip)
    await drag(at, { x: at.x + 120, y: at.y - 40 }, { steps: 10 })
    const oneTurn = editor.getShape(one).rotation
    const twoTurn = editor.getShape(two).rotation
    const after = editor.getSelectionPageBounds().center
    return {
      ok: Math.abs(oneTurn) > 0.05 && near(oneTurn, twoTurn, 0.01) && near(after.x, before.x, 3) && near(after.y, before.y, 3),
      note: 'both turned ' + round(oneTurn) + ', centre moved ' + round(after.x - before.x) + ' by ' + round(after.y - before.y)
    }
  })

  await attempt('the pointer wears a rotate cursor over the handle', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle()
    const grip = handleAt('top_left_rotate')
    if (!grip) return { ok: false, note: 'no rotate handle to grab' }
    const at = viewport(grip)
    pointer('pointerdown', at.x, at.y, 1)
    await frame()
    pointer('pointermove', at.x + 30, at.y - 20, 1)
    await frame()
    const cursor = editor.getInstanceState().cursor
    pointer('pointerup', at.x + 30, at.y - 20, 0)
    await settle()
    return { ok: Boolean(cursor) && String(cursor.type).includes('rotate'), note: 'cursor ' + (cursor ? cursor.type : 'none') }
  })

  section = 'Text'

  const stopEditing = () => {
    editor.setEditingShape(null)
    editor.setCurrentTool('select.idle')
  }

  const wordsOf = id => {
    const shape = editor.getShape(id)
    if (!shape) return ''
    return JSON.stringify(shape.props.richText || shape.props.text || '')
  }

  const caretIn = () => {
    const held = document.querySelector('[data-canvas-text-editor] [contenteditable="true"]')
    if (!held) return { ok: false, why: 'there is no box to type in' }
    const shell = held.getBoundingClientRect()
    const style = getComputedStyle(held)
    const size = parseFloat(style.fontSize) || 0
    const colour = style.caretColor
    const focused = document.activeElement === held || held.contains(document.activeElement)
    const where = document.getSelection()
    const inside = Boolean(where && where.rangeCount > 0 && held.contains(where.getRangeAt(0).startContainer))
    let line = 0
    if (where && where.rangeCount > 0) {
      const range = where.getRangeAt(0)
      const rects = range.getClientRects()
      line = rects.length ? rects[0].height : range.getBoundingClientRect().height
    }
    const why = []
    if (shell.height < size * 0.8) why.push('the box is ' + round(shell.height) + ' tall for ' + round(size) + ' type')
    if (!focused) why.push('nothing in it has the keyboard')
    if (!inside) why.push('the caret is not inside it')
    if (colour === 'transparent' || colour === 'rgba(0, 0, 0, 0)') why.push('the caret is painted in nothing')
    return {
      ok: why.length === 0,
      why: why.join(', '),
      note: 'box ' + round(shell.height) + ' tall, caret ' + round(line) + ', painted ' + colour
    }
  }

  const typeInto = async text => {
    const held = document.querySelector('[data-canvas-text-editor] [contenteditable="true"]')
    if (!held) return false
    const id = editor.getEditingShapeId()
    const before = id ? wordsOf(id) : held.textContent
    held.focus()
    try {
      document.execCommand('insertText', false, text)
    } catch (error) {
      void error
    }
    await settle(4)
    const landed = id ? wordsOf(id) !== before : held.textContent !== before
    if (landed) return true
    const line = held.querySelector('p') || held
    line.textContent = (line.textContent || '') + text
    held.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await settle(4)
    return true
  }

  await attempt('the text tool places a box you can see and type in', async () => {
    await clear()
    await scratch()
    editor.setCurrentTool('text')
    await settle()
    const at = inCanvas({ x: 400, y: 300 })
    pointer('pointerdown', at.x, at.y, 1)
    await frame()
    pointer('pointerup', at.x, at.y, 0)
    await settle(6)
    const id = editor.getEditingShapeId()
    if (!id) return { ok: false, note: 'nothing is being edited' }
    made.push(id)
    const shell = document.querySelector('[data-canvas-text-editor]')
    const style = shell ? getComputedStyle(shell) : null
    const width = style ? parseFloat(style.outlineWidth) : 0
    const drawn = Boolean(style) && style.outlineStyle !== 'none' && width > 0 && style.outlineColor !== 'rgba(0, 0, 0, 0)'
    const caret = caretIn()
    await typeInto('crewcheck')
    const written = wordsOf(id).includes('crewcheck')
    return {
      ok: drawn && caret.ok && written,
      note: 'box ' + (drawn ? round(width) + 'px of ' + style.outlineColor : 'not drawn') + ', caret ' + (caret.ok ? 'there' : caret.why) + ', typing ' + (written ? 'landed' : 'did not land')
    }
  })

  await attempt('an empty note has a caret', async () => {
    await clear()
    await scratch()
    const id = build('note', { x: 0, y: 0 }, {})
    await settle()
    editor.select(id)
    await settle()
    const at = viewport(boundsOf(id).center)
    pointer('pointermove', at.x, at.y, 0, nodeOf(id) || surface)
    await settle()
    await doubleClick(at, nodeOf(id) || surface)
    if (editor.getEditingShapeId() !== id)
      return { ok: false, note: 'a double click left the board in ' + editor.getCurrentToolPath() + ' with nothing being edited' }
    const caret = caretIn()
    return { ok: caret.ok, note: caret.ok ? caret.note : caret.why }
  })

  await attempt('clicking away from a text puts the board back', async () => {
    await clear()
    await scratch()
    const id = build('text', { x: 0, y: 0 }, {})
    await settle()
    editor.select(id)
    editor.startEditingShapeWithRichText(id)
    await settle(6)
    if (editor.getEditingShapeId() !== id) return { ok: false, note: 'it never opened for typing' }
    await click(empty())
    await settle(4)
    const path = editor.getCurrentToolPath()
    return {
      ok: editor.getEditingShapeId() === null && path === 'select.idle',
      note: 'editing ' + String(editor.getEditingShapeId()) + ', the board sits in ' + path
    }
  })

  await attempt('an empty text has a caret', async () => {
    await clear()
    await scratch()
    const id = build('text', { x: 0, y: 0 }, {})
    await settle()
    editor.select(id)
    editor.startEditingShapeWithRichText(id)
    await settle(6)
    const caret = caretIn()
    return { ok: caret.ok, note: caret.ok ? caret.note : caret.why }
  })

  await attempt('the box grows to fit what is typed', async () => {
    await clear()
    await scratch()
    const id = build('text', { x: 0, y: 0 }, {})
    await settle()
    editor.select(id)
    editor.startEditingShapeWithRichText(id)
    await settle(6)
    const before = boundsOf(id)
    await typeInto('a longer line of words than it started with')
    const after = boundsOf(id)
    stopEditing()
    await settle()
    return { ok: after.w > before.w + 20 || after.h > before.h + 4, note: round(before.w) + 'x' + round(before.h) + ' to ' + round(after.w) + 'x' + round(after.h) }
  })

  const sectionNamed = title => {
    const head = [...document.querySelectorAll('h3')].find(item => (item.textContent || '').trim() === title)
    return head ? head.closest('section') : null
  }
  const field = (label, within) =>
    (within || document).querySelector('input[aria-label="' + label + '"]')
  const setField = async (label, value, within) => {
    const input = field(label, within)
    if (!input) return false
    input.focus()
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(2)
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }))
    input.blur()
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await settle(4)
    return true
  }
  const pressButton = async (label, within) => {
    const button = (within || document).querySelector('button[aria-label="' + label + '"]')
    if (!button) return false
    button.click()
    await settle(4)
    return true
  }
  const typeOf = id => {
    const shape = editor.getShape(id)
    return (shape && shape.meta && shape.meta.type) || null
  }

  await attempt('font, size, spacing, line height and alignment stick', async () => {
    await clear()
    await scratch()
    const id = build('text', { x: 0, y: 0 }, {})
    await settle()
    editor.select(id)
    editor.startEditingShapeWithRichText(id)
    await settle(4)
    await typeInto('Settings hold')
    stopEditing()
    editor.select(id)
    await settle(6)
    const type = sectionNamed('Typography')
    if (!type || !field('Size', type)) return { ok: false, note: 'the typography fields never appeared for a text shape' }
    const took = []
    await setField('Size', 33, type)
    if (!near((typeOf(id) || {}).size, 33, 0.01)) took.push('setting the size did nothing')
    await setField('Letter spacing', 7, type)
    if (!near((typeOf(id) || {}).spacing, 7, 0.01)) took.push('setting the spacing did nothing')
    await setField('Line height', 175, type)
    if (!near((typeOf(id) || {}).lineHeight, 1.75, 0.01)) took.push('setting the line height did nothing')
    await pressButton('Align center', type)
    if (editor.getShape(id).props.textAlign !== 'middle') took.push('pressing centre did nothing')
    let family = null
    if (await pressButton('Font', type)) {
      const rows = [...document.querySelectorAll('div[class*="max-h-72"] button')]
      const wanted = rows.find(row => (row.textContent || '').trim() && row.textContent.trim() !== (typeOf(id) || {}).family)
      if (wanted) {
        wanted.click()
        await settle(4)
        family = typeOf(id) && typeOf(id).family
      } else {
        await pressButton('Font')
      }
    }
    if (took.length) return { ok: false, note: took.join(', ') }
    const set = typeOf(id)
    if (!set) return { ok: false, note: 'the shape carries no type at all' }
    press('Escape')
    await settle(2)
    editor.selectNone()
    await settle(4)
    await click(viewport(boundsOf(id).center))
    await settle(4)
    if (editor.getSelectedShapeIds().length !== 1)
      return { ok: false, note: 'clicking the text back selected ' + editor.getSelectedShapeIds().length + ' shapes' }
    const held = typeOf(id)
    const align = editor.getShape(id).props.textAlign
    const back = sectionNamed('Typography')
    const shown = label => {
      const input = field(label, back)
      return input ? input.value : 'no field'
    }
    const pressed = label => {
      const button = back && back.querySelector('button[aria-label="' + label + '"]')
      return Boolean(button) && button.getAttribute('aria-pressed') === 'true'
    }
    const wrong = []
    if (!near(held.size, 33, 0.01)) wrong.push('size is ' + held.size)
    if (!near(held.spacing, 7, 0.01)) wrong.push('spacing is ' + held.spacing)
    if (!near(held.lineHeight, 1.75, 0.01)) wrong.push('line height is ' + held.lineHeight)
    if (align !== 'middle') wrong.push('alignment is ' + align)
    if (family && held.family !== family) wrong.push('font is ' + held.family + ' where ' + family + ' was picked')
    if (shown('Size') !== '33') wrong.push('the size field reads ' + shown('Size'))
    if (shown('Letter spacing') !== '7') wrong.push('the spacing field reads ' + shown('Letter spacing'))
    if (shown('Line height') !== '175') wrong.push('the line height field reads ' + shown('Line height'))
    if (!pressed('Align center')) wrong.push('the centre button is not lit')
    return {
      ok: wrong.length === 0,
      note: wrong.length ? wrong.join(', ') : 'size ' + held.size + ', spacing ' + held.spacing + ', line height ' + held.lineHeight + ', ' + align + ', ' + held.family
    }
  })

  await attempt('letter spacing resizes the box', async () => {
    await clear()
    await scratch()
    const id = build('text', { x: 0, y: 0 }, {})
    await settle()
    editor.select(id)
    editor.startEditingShapeWithRichText(id)
    await settle(4)
    await typeInto('spacing moves the edges')
    stopEditing()
    editor.select(id)
    await settle(6)
    const before = boundsOf(id)
    if (!(await setField('Letter spacing', 12, sectionNamed('Typography'))))
      return { ok: false, note: 'there is no letter spacing field' }
    await settle(6)
    const after = boundsOf(id)
    return { ok: after.w > before.w + 8, note: round(before.w) + ' wide to ' + round(after.w) }
  })

  await attempt('typography holds when the shape is clicked', async () => {
    const id = made[made.length - 1]
    if (!id || editor.getShape(id) === undefined) return null
    const before = JSON.stringify(typeOf(id))
    const shell = JSON.stringify(boundsOf(id))
    editor.selectNone()
    await settle(2)
    await click(viewport(boundsOf(id).center))
    await settle(4)
    const after = JSON.stringify(typeOf(id))
    const settled = JSON.stringify(boundsOf(id))
    if (before !== after) return { ok: false, note: 'the type changed to ' + after.slice(0, 60) }
    return { ok: shell === settled, note: shell === settled ? 'held' : 'the box moved to ' + settled.slice(0, 60) }
  })

  section = 'Clipboard and history'

  await attempt('copy and paste', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    await settle()
    editor.select(one)
    editor.getContainer().focus()
    await settle()
    const start = editor.getCurrentPageShapes().length
    press('c', { metaKey: true })
    await settle()
    press('v', { metaKey: true })
    await settle(4)
    const after = editor.getCurrentPageShapes().length
    for (const shape of editor.getCurrentPageShapes()) if (!made.includes(shape.id) && !shapes.some(one => one.id === shape.id)) made.push(shape.id)
    return { ok: after === start + 1, note: start + ' to ' + after }
  })

  await attempt('cut takes the shape away', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    await settle()
    editor.select(one)
    editor.getContainer().focus()
    await settle()
    const start = editor.getCurrentPageShapes().length
    press('x', { metaKey: true })
    await settle(4)
    const cut = editor.getCurrentPageShapes().length
    const gone = editor.getShape(one) === undefined
    press('v', { metaKey: true })
    await settle(4)
    const back = editor.getCurrentPageShapes().length
    for (const shape of editor.getCurrentPageShapes()) if (!made.includes(shape.id) && !shapes.some(one => one.id === shape.id)) made.push(shape.id)
    return { ok: gone && cut === start - 1 && back === start, note: start + ' to ' + cut + ' to ' + back + ', the shape ' + (gone ? 'went' : 'stayed') }
  })

  await attempt('duplicate and delete', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 120, h: 90 })
    await settle()
    editor.select(one)
    editor.getContainer().focus()
    await settle()
    const start = editor.getCurrentPageShapes().length
    press('d', { metaKey: true })
    await settle()
    const copied = editor.getCurrentPageShapes().length
    for (const shape of editor.getCurrentPageShapes()) if (!made.includes(shape.id) && !shapes.some(one => one.id === shape.id)) made.push(shape.id)
    press('Delete')
    await settle()
    const left = editor.getCurrentPageShapes().length
    return { ok: copied === start + 1 && left === copied - 1, note: start + ' to ' + copied + ' to ' + left }
  })

  const undoable = [
    {
      name: 'a move',
      act: async id => {
        const at = viewport(boundsOf(id).center)
        await drag(at, { x: at.x + 80, y: at.y })
      },
      read: id => round(boundsOf(id).minX)
    },
    {
      name: 'a resize',
      act: async id => {
        const grip = handleAt('bottom_right')
        if (!grip) return
        const at = viewport(grip)
        await drag(at, { x: at.x + 60, y: at.y + 40 })
      },
      read: id => round(boundsOf(id).w)
    },
    {
      name: 'a turn',
      act: async id => {
        const grip = handleAt('top_left_rotate')
        if (!grip) {
          editor.markHistoryStoppingPoint('turn')
          editor.rotateShapesBy([id], 0.6)
          await settle()
          return
        }
        const at = viewport(grip)
        await drag(at, { x: at.x + 120, y: at.y - 40 }, { steps: 10 })
      },
      read: id => round(editor.getShape(id).rotation)
    },
    {
      name: 'a nudge',
      act: async () => {
        press('ArrowRight')
        await settle()
      },
      read: id => round(boundsOf(id).minX)
    },
    {
      name: 'a delete',
      act: async () => {
        press('Delete')
        await settle()
      },
      read: id => (editor.getShape(id) === undefined ? 'gone' : 'there')
    },
    {
      name: 'a cut',
      act: async () => {
        press('x', { metaKey: true })
        await settle(4)
      },
      read: id => (editor.getShape(id) === undefined ? 'gone' : 'there')
    },
    {
      name: 'a duplicate',
      act: async () => {
        press('d', { metaKey: true })
        await settle(4)
      },
      read: () => editor.getCurrentPageShapes().length
    },
    {
      name: 'a paste',
      act: async () => {
        press('c', { metaKey: true })
        await settle()
        press('v', { metaKey: true })
        await settle(4)
      },
      read: () => editor.getCurrentPageShapes().length
    }
  ]

  for (const step of undoable) {
    await attempt('undo and redo across ' + step.name, async () => {
      await clear()
      await scratch()
      const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
      await settle()
      editor.select(one)
      editor.getContainer().focus()
      await settle()
      const start = step.read(one)
      await step.act(one)
      const acted = step.read(one)
      for (const shape of editor.getCurrentPageShapes()) if (!made.includes(shape.id) && !shapes.some(other => other.id === shape.id)) made.push(shape.id)
      if (String(acted) === String(start))
        return { ok: false, note: step.name + ' changed nothing to undo, with the board in ' + editor.getCurrentToolPath() }
      editor.undo()
      await settle(4)
      const undone = step.read(one)
      editor.redo()
      await settle(4)
      const redone = step.read(one)
      for (const shape of editor.getCurrentPageShapes()) if (!made.includes(shape.id) && !shapes.some(other => other.id === shape.id)) made.push(shape.id)
      return {
        ok: String(undone) === String(start) && String(redone) === String(acted),
        note: start + ' to ' + acted + ', undo ' + undone + ', redo ' + redone
      }
    })
  }

  await attempt('a whole number scrub is one undo entry', async () => {
    await clear()
    await scratch()
    const id = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(id)
    await settle(6)
    const grip = document.querySelector('[data-scrub="W"]') || document.querySelector('[data-scrub="Width"]') || document.querySelector('[data-scrub]')
    if (!grip) return { ok: false, note: 'the inspector draws no field to scrub' }
    const label = grip.getAttribute('data-scrub')
    grip.setPointerCapture = () => {}
    grip.releasePointerCapture = () => {}
    const start = JSON.stringify(editor.getShape(id).props)
    const at = grip.getBoundingClientRect()
    const from = { x: at.left + at.width / 2, y: at.top + at.height / 2 }
    grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: from.x, clientY: from.y, button: 0, buttons: 1, pointerId: 3, pointerType: 'mouse', isPrimary: true }))
    await frame()
    for (let step = 1; step <= 12; step++) {
      grip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientX: from.x + step * 4, clientY: from.y, button: 0, buttons: 1, pointerId: 3, pointerType: 'mouse', isPrimary: true }))
      await frame()
    }
    grip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: from.x + 48, clientY: from.y, button: 0, buttons: 0, pointerId: 3, pointerType: 'mouse', isPrimary: true }))
    await settle(6)
    const scrubbed = JSON.stringify(editor.getShape(id).props)
    if (scrubbed === start) return { ok: false, note: 'scrubbing ' + label + ' changed nothing' }
    editor.undo()
    await settle(4)
    const undone = JSON.stringify(editor.getShape(id).props)
    return { ok: undone === start, note: 'scrubbed ' + label + ', one undo ' + (undone === start ? 'put it all back' : 'left part of it') }
  })

  section = 'The board itself'

  await attempt('a marquee selects several on the real board', async () => {
    await clear()
    editor.selectNone()
    editor.zoomToFit({ immediate: true })
    await settle()
    await stillCamera()
    const all = editor.getCurrentPageBounds()
    const shell = box()
    const from = { x: shell.left + 10, y: shell.top + 10 }
    const under = editor.getShapeAtPoint(pageAt(from), {
      margin: editor.options.hitTestMargin / editor.getZoomLevel(),
      hitInside: true,
      renderingOnly: true
    })
    if (under) return { ok: false, note: 'a ' + under.type + ' sits where the marquee would start, so it would drag the board about' }
    await drag(from, viewport(all.center))
    return { ok: editor.getSelectedShapeIds().length > 1, note: editor.getSelectedShapeIds().length + ' selected' }
  })

  await attempt('select all', async () => {
    editor.selectNone()
    editor.getContainer().focus()
    press('a', { metaKey: true })
    await settle()
    return { ok: editor.getSelectedShapeIds().length > 1, note: editor.getSelectedShapeIds().length + ' selected' }
  })

  await attempt('escape clears the selection', async () => {
    editor.select(shapes[0].id)
    await settle()
    press('Escape')
    await settle()
    return { ok: editor.getSelectedShapeIds().length === 0 }
  })

  await attempt('group and ungroup', async () => {
    const pair = editor
      .getCurrentPageShapes()
      .filter(shape => editor.getShapeParent(shape) === undefined || editor.getShapeParent(shape).typeName === 'page')
      .slice(0, 2)
      .map(shape => shape.id)
    if (pair.length < 2) return null
    const before = editor.getCurrentPageShapes().filter(shape => shape.type === 'group').map(shape => shape.id)
    editor.setSelectedShapes(pair)
    editor.getContainer().focus()
    await settle()
    press('g', { metaKey: true })
    await settle()
    const made = editor
      .getCurrentPageShapes()
      .filter(shape => shape.type === 'group' && !before.includes(shape.id))
      .map(shape => shape.id)
    press('g', { metaKey: true, shiftKey: true })
    await settle()
    const gone = made.every(id => editor.getShape(id) === undefined)
    return {
      ok: made.length === 1 && gone,
      note: 'grouped ' + (made.length === 1) + ' ungrouped ' + gone + ', beside ' + before.length + ' the board already had'
    }
  })

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
      const wasAt = boundsOf(grabbed.id)
      const at = viewport(centre)
      await drag(at, { x: at.x + 44, y: at.y + 32 }, { target: nodeOf(grabbed.id) })
      const nowAt = boundsOf(grabbed.id)
      const moved = Boolean(nowAt) && (!near(nowAt.minX, wasAt.minX, 1) || !near(nowAt.minY, wasAt.minY, 1))
      const family = [grabbed.id].concat(editor.getShapeAncestors(grabbed).map(one => one.id))
      const selected = editor.getSelectedShapeIds().some(id => family.includes(id))
      const carried = editor.getSelectedShapeIds().filter(id => id !== grabbed.id && family.includes(id))
      if (moved) {
        const mover = carried.length ? editor.getShape(carried[0]) : null
        if (mover) editor.updateShape({ id: mover.id, type: mover.type, x: mover.x - (nowAt.minX - wasAt.minX), y: mover.y - (nowAt.minY - wasAt.minY) })
        else await restore(grabbed, before)
        await frame()
      }
      const over = grabbed.id === shape.id ? '' : ', over it'
      const by = carried.length ? ' by the ' + editor.getShape(carried[0]).type + ' it stands in' : ''
      if (moved) return { ok: true, note: 'moved the ' + grabbed.type + over + by }
      if (selected) return { ok: true, note: 'selected the ' + grabbed.type + over + by + ', which is not dragged from here' }
      return { ok: false, note: 'pressing the ' + grabbed.type + over + ' neither moved nor selected anything' }
    })
  }

  await attempt('an edge handle resizes a text', async () => {
    const text = shapes.find(shape => shape.type === 'text' && shape.props.autoSize) || oneOf('text')
    if (!text) return null
    const original = editor.getShape(text.id)
    const camera = editor.getCamera()
    editor.select(text.id)
    editor.zoomToBounds(boundsOf(text.id), { targetZoom: 1, immediate: true })
    await settle()
    const before = boundsOf(text.id)
    const beforeProps = editor.getShape(text.id).props
    const handle = viewport({ x: before.maxX, y: before.center.y })
    await drag(handle, { x: handle.x + 90, y: handle.y })
    const after = boundsOf(text.id)
    const afterProps = editor.getShape(text.id).props
    const widened =
      after.w - before.w > 1 &&
      afterProps.w > beforeProps.w &&
      afterProps.autoSize === false &&
      afterProps.scale === beforeProps.scale
    editor.updateShape({ id: original.id, type: original.type, props: original.props })
    editor.setCamera(camera, { immediate: true })
    await settle()
    return {
      ok: widened,
      note:
        round(before.w) +
        ' wide to ' +
        round(after.w) +
        ', fixed ' +
        String(afterProps.autoSize === false) +
        ', scale held ' +
        String(afterProps.scale === beforeProps.scale)
    }
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
      const count = editor.getCurrentPageShapes().length - start
      editor.setCurrentTool('select')
      await settle()
      if (count > 0) {
        editor.deleteShapes(editor.getCurrentPageShapes().slice(-count).map(shape => shape.id))
        await settle()
      }
      return { ok: count > 0, note: count + ' made' }
    })
  }

  await attempt('the text tool leaves the caret in what it made', async () => {
    editor.selectNone()
    editor.setCurrentTool('text')
    await settle()
    const start = editor.getCurrentPageShapes().length
    const centre = viewport(editor.getViewportPageBounds().center)
    const at = { x: centre.x + 170, y: centre.y + 130 }
    pointer('pointerdown', at.x, at.y, 1)
    await frame()
    pointer('pointerup', at.x, at.y, 0)
    const focus = () => {
      const found = document.querySelector('[contenteditable="true"], textarea')
      return Boolean(found) && (document.activeElement === found || found.contains(document.activeElement))
    }
    let waited = 0
    while (waited < 12 && !focus()) {
      await frame()
      waited++
    }
    const count = editor.getCurrentPageShapes().length - start
    const editing = editor.getEditingShapeId()
    const focused = focus()
    stopEditing()
    editor.setCurrentTool('select')
    await settle()
    if (count > 0) {
      editor.deleteShapes(editor.getCurrentPageShapes().slice(-count).map(shape => shape.id))
      await settle()
    }
    if (count < 1) return { ok: false, note: 'the tool made nothing' }
    if (!editing) return { ok: false, note: 'it made a text and nothing is being edited' }
    if (!focused) return { ok: false, note: 'editing, but the caret never landed' }
    return { ok: waited <= 3, note: 'the caret landed after ' + waited + ' frames' }
  })

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
    editor.zoomToBounds(boundsOf(editable.id), { targetZoom: 1, immediate: true })
    await settle()
    await doubleClick(viewport(boundsOf(editable).center), nodeOf(editable.id) || surface)
    const editing = editor.getEditingShapeId()
    const caret = document.querySelector('[contenteditable="true"], textarea')
    stopEditing()
    await settle()
    return { ok: Boolean(editing) && Boolean(caret), note: 'editing ' + Boolean(editing) + ' caret ' + Boolean(caret) }
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
    return { ok: editor.getZoomLevel() !== before, note: round(before) + ' to ' + round(editor.getZoomLevel()) }
  })

  await attempt('hovering marks a shape', async () => {
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    const centre = viewport(boundsOf(one).center)
    pointer('pointermove', centre.x, centre.y, 0, nodeOf(one))
    await settle()
    const hovered = editor.getHoveredShapeId ? editor.getHoveredShapeId() : null
    return { ok: hovered === one, note: 'hovered ' + (hovered === one ? 'it' : String(hovered)) }
  })

  await attempt('snapping produces indicators', async () => {
    await clear()
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
    editor.zoomToFit({ immediate: true })
    await settle()
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

  section = 'Painting'

  const overlayNode = document.querySelector('[data-canvas-overlays="true"]')
  const painting = { on: false, calls: [] }
  const heldPaint = {}
  const watchPainting = () => {
    if (!overlayNode || heldPaint.clearRect) return
    for (const name of ['clearRect', 'fillRect', 'strokeRect', 'stroke', 'fill']) {
      const original = CanvasRenderingContext2D.prototype[name]
      heldPaint[name] = original
      CanvasRenderingContext2D.prototype[name] = function (...args) {
        if (painting.on && this.canvas === overlayNode) {
          const m = this.getTransform()
          painting.calls.push({
            op: name,
            args: args.filter(one => typeof one === 'number'),
            m: [m.a, m.b, m.c, m.d, m.e, m.f]
          })
        }
        return original.apply(this, args)
      }
    }
  }
  const stopPainting = () => {
    for (const name of Object.keys(heldPaint)) CanvasRenderingContext2D.prototype[name] = heldPaint[name]
  }
  const openPaint = () => {
    watchPainting()
    painting.calls = []
    painting.on = true
  }
  const shutPaint = () => {
    painting.on = false
  }
  const stepPaint = async act => {
    const mark = painting.calls.length
    await act()
    await frame()
    return painting.calls.slice(mark)
  }
  const paintedBox = call => {
    const shell = overlayNode.getBoundingClientRect()
    const wide = shell.width / overlayNode.width
    const tall = shell.height / overlayNode.height
    const at = (x, y) => ({
      x: shell.left + (call.m[0] * x + call.m[2] * y + call.m[4]) * wide,
      y: shell.top + (call.m[1] * x + call.m[3] * y + call.m[5]) * tall
    })
    const one = at(call.args[0], call.args[1])
    const other = at(call.args[0] + call.args[2], call.args[1] + call.args[3])
    return {
      minX: Math.min(one.x, other.x),
      minY: Math.min(one.y, other.y),
      maxX: Math.max(one.x, other.x),
      maxY: Math.max(one.y, other.y)
    }
  }
  const boxesOf = (calls, op) => calls.filter(call => call.op === op && call.args.length === 4).map(paintedBox)
  const repainted = calls => calls.some(call => call.op === 'clearRect')
  const spanning = (one, other) => ({
    minX: Math.min(one.x, other.x),
    minY: Math.min(one.y, other.y),
    maxX: Math.max(one.x, other.x),
    maxY: Math.max(one.y, other.y)
  })
  const onScreen = id => {
    const bounds = boundsOf(id)
    return spanning(viewport({ x: bounds.minX, y: bounds.minY }), viewport({ x: bounds.maxX, y: bounds.maxY }))
  }
  const boxOff = (one, other) =>
    Math.max(
      Math.abs(one.minX - other.minX),
      Math.abs(one.minY - other.minY),
      Math.abs(one.maxX - other.maxX),
      Math.abs(one.maxY - other.maxY)
    )
  const nearest = (boxes, wanted) => boxes.map(box => boxOff(box, wanted)).sort((one, other) => one - other)[0]
  const aimAt = id => {
    const bounds = boundsOf(id)
    if (!bounds) return null
    const tries = [bounds.center, { x: bounds.minX + 1, y: bounds.center.y }, { x: bounds.center.x, y: bounds.minY + 1 }]
    for (const point of tries) {
      const hit = editor.getShapeAtPoint(point, {
        hitInside: false,
        hitLabels: false,
        hitLocked: editor.options.selectLockedShapes,
        margin: editor.hitTestMargin / editor.getZoomLevel(),
        renderingOnly: true
      })
      if (hit && hit.id === id) return viewport(point)
    }
    return null
  }
  const grid = async () => {
    await clear()
    await scratch()
    for (let down = 0; down < 5; down++)
      for (let across = 0; across < 8; across++) rect({ x: across * 80, y: down * 60 }, { w: 60, h: 40 })
    await settle()
  }

  const brushed = { frames: 0, missed: 0, still: 0, lag: 0, covered: 0 }

  await attempt('a marquee is painted on every frame', async () => {
    if (!overlayNode) return { ok: false, note: 'the board draws no overlay canvas to paint the chrome on' }
    await grid()
    editor.selectNone()
    await settle()
    const from = inCanvas({ x: 60, y: 60 })
    const step = { x: 21, y: 12 }
    const steps = 40
    openPaint()
    pointer('pointerdown', from.x, from.y, 1)
    await frame()
    let widest = -Infinity
    for (let move = 1; move <= steps; move++) {
      const to = { x: from.x + step.x * move, y: from.y + step.y * move }
      const drawn = await stepPaint(async () => {
        pointer('pointermove', to.x, to.y, 1)
      })
      const brush = boxesOf(drawn, 'fillRect')[0]
      brushed.frames++
      if (!brush) {
        brushed.missed++
        continue
      }
      brushed.lag = Math.max(brushed.lag, boxOff(brush, spanning(from, to)))
      if (brush.maxX <= widest) brushed.still++
      widest = brush.maxX
    }
    brushed.covered = editor.getSelectedShapeIds().length
    pointer('pointerup', from.x + step.x * steps, from.y + step.y * steps, 0)
    await settle()
    shutPaint()
    return {
      ok: brushed.missed === 0,
      note: 'drawn on ' + (brushed.frames - brushed.missed) + ' of ' + brushed.frames + ' frames, over ' + brushed.covered + ' shapes'
    }
  })

  await attempt('the marquee is drawn where the pointer is', async () => {
    if (brushed.frames === 0) return { ok: false, note: 'the marquee never ran' }
    if (brushed.missed) return { ok: false, note: brushed.missed + ' frames drew no marquee at all' }
    return {
      ok: brushed.lag <= 1.5 && brushed.still === 0,
      note:
        'the furthest it sat from the pointer was ' +
        round(brushed.lag) +
        'px, and it stood still on ' +
        brushed.still +
        ' of ' +
        brushed.frames +
        ' frames'
    }
  })

  await attempt('the overlay really has ink under the marquee', async () => {
    if (!overlayNode) return { ok: false, note: 'the board draws no overlay canvas' }
    await grid()
    editor.selectNone()
    await settle()
    const from = inCanvas({ x: 60, y: 60 })
    const to = { x: from.x + 700, y: from.y + 400 }
    pointer('pointerdown', from.x, from.y, 1)
    await frame()
    pointer('pointermove', to.x, to.y, 1)
    await frame()
    const context = overlayNode.getContext('2d')
    const shell = overlayNode.getBoundingClientRect()
    const pixels = context.getImageData(0, 0, overlayNode.width, overlayNode.height).data
    const alphaAt = (x, y) => {
      const across = Math.round((x - shell.left) * (overlayNode.width / shell.width))
      const down = Math.round((y - shell.top) * (overlayNode.height / shell.height))
      return pixels[(down * overlayNode.width + across) * 4 + 3]
    }
    const middle = alphaAt((from.x + to.x) / 2, (from.y + to.y) / 2)
    const edge = alphaAt((from.x + to.x) / 2, from.y)
    const beyond = alphaAt(shell.right - 40, shell.bottom - 40)
    pointer('pointerup', to.x, to.y, 0)
    await settle()
    return {
      ok: (middle > 0 || edge > 0) && beyond === 0,
      note: 'inside it the canvas reads ' + middle + ' and along its edge ' + edge + ', where past it reads ' + beyond
    }
  })

  for (const kind of [
    { type: 'design-node', props: { w: 200, h: 160, shape: 'rect', name: 'Probe' } },
    { type: 'geo', props: { w: 200, h: 160 } },
    { type: 'note', props: {} }
  ]) {
    await attempt('hovering a ' + kind.type + ' paints an outline', async () => {
      if (!overlayNode) return { ok: false, note: 'the board draws no overlay canvas' }
      await clear()
      await scratch()
      const one = build(kind.type, { x: 0, y: 0 }, kind.props)
      await settle()
      editor.selectNone()
      await settle()
      await stillCamera()
      const at = aimAt(one)
      if (!at) return { ok: false, note: 'the board finds no ' + kind.type + ' anywhere on the shape it drew' }
      openPaint()
      const onto = await stepPaint(async () => {
        pointer('pointermove', at.x, at.y, 0, nodeOf(one) || surface)
      })
      const hovered = editor.getHoveredShapeId ? editor.getHoveredShapeId() : null
      if (hovered !== one) {
        shutPaint()
        return { ok: false, note: 'the pointer landed on ' + String(hovered) + ' rather than the ' + kind.type }
      }
      const away = await stepPaint(async () => {
        pointer('pointermove', empty().x, empty().y, 0)
      })
      const left = editor.getHoveredShapeId ? editor.getHoveredShapeId() : null
      const after = await stepPaint(async () => {})
      shutPaint()
      const drawn = onto.filter(call => call.op === 'stroke').length
      const strokes = away.filter(call => call.op === 'stroke').length
      const later = after.filter(call => call.op === 'stroke').length
      if (!drawn) return { ok: false, note: 'nothing was stroked on the frame the pointer arrived' }
      if (left === one) return { ok: false, note: 'the board still reads the pointer as over it after it moved away' }
      if (later > 0) return { ok: false, note: 'the outline was still on screen two frames after the pointer left' }
      if (strokes > 0)
        return { ok: true, note: 'drawn as the pointer arrived, and gone a frame after it left rather than on the frame itself' }
      if (!repainted(away))
        return { ok: false, note: 'the frame the pointer left painted nothing, so the outline stayed on screen' }
      return { ok: true, note: 'drawn as the pointer arrived and gone as it left' }
    })
  }

  await attempt('hovering a shape on the real board paints an outline', async () => {
    if (!overlayNode) return { ok: false, note: 'the board draws no overlay canvas' }
    await clear()
    editor.selectNone()
    editor.zoomToFit({ immediate: true })
    await settle()
    const zoom = editor.getZoomLevel()
    const target = shapes
      .filter(shape => {
        const bounds = boundsOf(shape)
        if (!bounds || bounds.w * zoom < 24 || bounds.h * zoom < 24) return false
        return Boolean(aimAt(shape.id))
      })
      .pop()
    if (!target) return null
    const at = aimAt(target.id)
    openPaint()
    const onto = await stepPaint(async () => {
      pointer('pointermove', at.x, at.y, 0, nodeOf(target.id) || surface)
    })
    const hovered = editor.getHoveredShapeId ? editor.getHoveredShapeId() : null
    shutPaint()
    if (hovered !== target.id) return { ok: false, note: 'the pointer landed on ' + String(hovered) + ' rather than the ' + target.type }
    return {
      ok: onto.some(call => call.op === 'stroke'),
      note: onto.some(call => call.op === 'stroke') ? 'a ' + target.type + ' outlined at zoom ' + round(zoom) : 'the ' + target.type + ' was hovered and nothing was stroked'
    }
  })

  await attempt('the chrome keeps up with a shape being dragged', async () => {
    if (!overlayNode) return { ok: false, note: 'the board draws no overlay canvas' }
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle(4)
    const stale = onScreen(one)
    const at = viewport(boundsOf(one).center)
    const step = { x: 9, y: 6 }
    const steps = 20
    let frozen = 0
    let followed = 0
    let quiet = 0
    openPaint()
    editor.selectNone()
    await frame()
    let held = await stepPaint(async () => {
      editor.select(one)
    })
    if (!boxesOf(held, 'strokeRect').some(box => boxOff(box, stale) <= 2)) {
      shutPaint()
      return { ok: false, note: 'a shape sitting still and selected draws no box around itself' }
    }
    const down = await stepPaint(async () => {
      pointer('pointerdown', at.x, at.y, 1, nodeOf(one) || surface)
    })
    if (repainted(down)) held = down
    for (let move = 1; move <= steps; move++) {
      const to = { x: at.x + step.x * move, y: at.y + step.y * move }
      const drawn = await stepPaint(async () => {
        pointer('pointermove', to.x, to.y, 1)
      })
      if (repainted(drawn)) held = drawn
      else quiet++
      const boxes = boxesOf(held, 'strokeRect').concat(boxesOf(held, 'fillRect'))
      const wanted = onScreen(one)
      if (boxOff(wanted, stale) > 4 && boxes.some(box => boxOff(box, stale) <= 2)) frozen++
      if (boxes.some(box => boxOff(box, wanted) <= 2)) followed++
    }
    pointer('pointerup', at.x + step.x * steps, at.y + step.y * steps, 0)
    await settle()
    shutPaint()
    return {
      ok: frozen === 0,
      note: frozen
        ? 'the chrome sat where the shape started on ' + frozen + ' of ' + steps + ' frames'
        : 'the board holds a box on ' + followed + ' of ' + steps + ' frames of a drag, and never one where the shape started, with ' + quiet + ' frames painting nothing'
    }
  })

  await attempt('the selection box is drawn where the shape is on every frame of a pan', async () => {
    if (!overlayNode) return { ok: false, note: 'the board draws no overlay canvas' }
    await clear()
    await scratch()
    const one = rect({ x: 0, y: 0 }, { w: 200, h: 160 })
    await settle()
    editor.select(one)
    await settle(4)
    const steps = 20
    let missed = 0
    let lag = 0
    openPaint()
    for (let move = 1; move <= steps; move++) {
      const drawn = await stepPaint(async () => {
        surface.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 14, deltaY: 9 }))
      })
      const off = nearest(boxesOf(drawn, 'strokeRect'), onScreen(one))
      if (off === undefined) missed++
      else lag = Math.max(lag, off)
    }
    shutPaint()
    return {
      ok: missed === 0 && lag <= 2,
      note: missed
        ? missed + ' of ' + steps + ' frames drew no box at all while the board moved under it'
        : 'the furthest it sat from the shape was ' + round(lag) + 'px over ' + steps + ' frames'
    }
  })

  stopPainting()
  await clear()

  section = 'Speed'

  const MOVES = 60
  const summarise = samples => {
    const sorted = samples.slice().sort((a, b) => a - b)
    const total = sorted.reduce((sum, value) => sum + value, 0)
    return {
      mean: round(total / sorted.length),
      median: round(sorted[Math.floor(sorted.length / 2)]),
      p95: round(sorted[Math.floor(sorted.length * 0.95)]),
      worst: round(sorted[sorted.length - 1])
    }
  }
  const measure = async (from, step, modifiers) => {
    const handler = []
    const painted = []
    pointer('pointerdown', from.x, from.y, 1, undefined, modifiers)
    await frame()
    probe.canvasCommits = 0
    probe.overlayCommits = 0
    probe.appCommits = 0
    for (let at = 1; at <= MOVES; at++) {
      const began = performance.now()
      pointer('pointermove', from.x + step.x * at, from.y + step.y * at, 1, undefined, modifiers)
      const done = performance.now()
      await frame()
      handler.push(done - began)
      painted.push(performance.now() - began)
    }
    const commits = { canvas: probe.canvasCommits, overlay: probe.overlayCommits, app: probe.appCommits }
    pointer('pointerup', from.x + step.x * MOVES, from.y + step.y * MOVES, 0, undefined, modifiers)
    await settle()
    return { handler: summarise(handler), painted: summarise(painted), commits }
  }

  const listNow = () =>
    editor.getRenderingShapes().map(item => ({
      id: item.id,
      index: item.index,
      backgroundIndex: item.backgroundIndex,
      opacity: item.opacity,
      isEditing: item.isEditing,
      type: item.shape.type,
      props: item.shape.props,
      meta: item.shape.meta
    }))
  const driftBetween = (before, after) => {
    if (before.length !== after.length) return ['the list changed length']
    const reasons = new Set()
    for (let at = 0; at < before.length; at++) {
      const one = before[at]
      const other = after[at]
      if (one.id !== other.id) reasons.add('the order moved')
      if (one.index !== other.index || one.backgroundIndex !== other.backgroundIndex) reasons.add('a shape changed layer')
      if (one.opacity !== other.opacity) reasons.add('an opacity changed')
      if (one.isEditing !== other.isEditing) reasons.add('an editing flag changed')
      if (one.props !== other.props) reasons.add('a shape was handed new props')
      if (one.meta !== other.meta) reasons.add('a shape was handed new meta')
    }
    return [...reasons]
  }
  const driftOverDrag = async (from, step, moves) => {
    pointer('pointerdown', from.x, from.y, 1)
    await frame()
    let held = listNow()
    let drifted = 0
    const reasons = new Set()
    for (let at = 1; at <= moves; at++) {
      pointer('pointermove', from.x + step.x * at, from.y + step.y * at, 1)
      await frame()
      const now = listNow()
      const why = driftBetween(held, now)
      if (why.length) {
        drifted++
        for (const reason of why) reasons.add(reason)
      }
      held = now
    }
    pointer('pointerup', from.x + step.x * moves, from.y + step.y * moves, 0)
    await settle()
    return { drifted, moves, reasons: [...reasons] }
  }

  const speed = {}
  await attempt('a marquee stays under eight milliseconds a move', async () => {
    await clear()
    editor.selectNone()
    editor.zoomToFit({ immediate: true })
    await settle()
    const shell = box()
    speed.marquee = await measure({ x: shell.left + 10, y: shell.top + 10 }, { x: 6, y: 4 })
    return { ok: speed.marquee.handler.p95 <= 8, note: 'p95 ' + speed.marquee.handler.p95 + 'ms, worst ' + speed.marquee.handler.worst + 'ms, painted p95 ' + speed.marquee.painted.p95 + 'ms' }
  })

  const busy = () => {
    editor.selectNone()
    editor.zoomToFit({ immediate: true })
    const centre = editor.getViewportPageBounds().center
    return editor
      .getCurrentPageShapes()
      .filter(shape => {
        const bounds = boundsOf(shape)
        return bounds && bounds.w > 30 && bounds.h > 30 && editor.getShapeUtil(shape).canResize(shape)
      })
      .sort((one, other) => {
        const a = boundsOf(one).center
        const b = boundsOf(other).center
        return (a.x - centre.x) ** 2 + (a.y - centre.y) ** 2 - ((b.x - centre.x) ** 2 + (b.y - centre.y) ** 2)
      })[0]
  }

  await attempt('a drag stays under eight milliseconds a move', async () => {
    await clear()
    const target = busy()
    if (!target) return { ok: false, note: 'no resizable shape to drag' }
    await settle()
    editor.select(target.id)
    await settle()
    speed.drag = await measure(viewport(boundsOf(target).center), { x: 1.5, y: 1 })
    editor.select(target.id)
    await settle()
    speed.drag.drift = await driftOverDrag(viewport(boundsOf(target).center), { x: 1.5, y: 1 }, 10)
    return { ok: speed.drag.handler.p95 <= 8, note: 'p95 ' + speed.drag.handler.p95 + 'ms, worst ' + speed.drag.handler.worst + 'ms, painted p95 ' + speed.drag.painted.p95 + 'ms' }
  })

  const commitsOver = async (from, step, buttons) => {
    probe.canvasCommits = 0
    probe.overlayCommits = 0
    for (let at = 1; at <= MOVES; at++) {
      pointer('pointermove', from.x + step.x * at, from.y + step.y * at, buttons)
      await frame()
    }
    return { canvas: probe.canvasCommits, overlay: probe.overlayCommits }
  }

  await attempt('a drag commits nothing in React', async () => {
    const counted = []
    let hovering = null
    for (const type of ['design-node', 'note', 'geo', 'text', 'draw']) {
      await clear()
      await scratch()
      const one = build(type, { x: 0, y: 0 }, type === 'design-node' || type === 'geo' ? { w: 200, h: 160 } : {})
      await settle()
      const bounds = boundsOf(one)
      if (!bounds || bounds.w < 4 || bounds.h < 4) continue
      if (!hovering) {
        editor.selectNone()
        await settle()
        const over = viewport(bounds.center)
        hovering = await commitsOver({ x: over.x - 60, y: over.y }, { x: 1.5, y: 1 }, 0)
      }
      editor.select(one)
      await settle()
      const from = viewport(boundsOf(one).center)
      pointer('pointerdown', from.x, from.y, 1)
      await frame()
      const dragging = await commitsOver(from, { x: 1.5, y: 1 }, 1)
      pointer('pointerup', from.x + 90, from.y + 60, 0)
      await settle()
      counted.push({ type, canvas: dragging.canvas, overlay: dragging.overlay })
    }
    const noisy = counted.filter(one => one.canvas > 0 || one.overlay > 0)
    const drift = speed.drag && speed.drag.drift
    const list = drift
      ? ', and the list of shapes to render read as unchanged on ' + (drift.moves - drift.drifted) + ' of ' + drift.moves + ' moves'
      : ''
    return {
      ok: noisy.length === 0,
      note:
        'over ' + MOVES + ' moves of one shape on its own, with nothing bound to it: ' +
        counted.map(one => one.type + ' ' + one.canvas).join(', ') +
        ' in the canvas, where hovering commits ' + (hovering ? hovering.canvas : 0) + list
    }
  })

  await attempt('a resize stays under eight milliseconds a move', async () => {
    await clear()
    const target = busy()
    if (!target) return { ok: false, note: 'no resizable shape to resize' }
    await settle()
    editor.select(target.id)
    await settle()
    const grip = handleAt('bottom_right')
    if (!grip) return { ok: false, note: 'no handle to grab' }
    speed.resize = await measure(viewport(grip), { x: 1.5, y: 1 })
    return { ok: speed.resize.handler.p95 <= 8, note: 'p95 ' + speed.resize.handler.p95 + 'ms, worst ' + speed.resize.handler.worst + 'ms, painted p95 ' + speed.resize.painted.p95 + 'ms' }
  })

  await attempt('clicking from shape to shape never stalls', async () => {
    await clear()
    editor.selectNone()
    editor.zoomToFit({ immediate: true })
    await settle()
    const targets = editor
      .getCurrentPageShapes()
      .filter(shape => shape.parentId === editor.getCurrentPageId() && boundsOf(shape))
      .slice(0, 24)
    if (targets.length < 2) return null
    const handler = []
    const painted = []
    const seen = new Set()
    for (let at = 0; at < MOVES; at++) {
      const target = targets[at % targets.length]
      const point = viewport(boundsOf(target).center)
      const began = performance.now()
      pointer('pointerdown', point.x, point.y, 1, nodeOf(target.id))
      pointer('pointerup', point.x, point.y, 0, nodeOf(target.id))
      const done = performance.now()
      seen.add(selection())
      await frame()
      handler.push(done - began)
      painted.push(performance.now() - began)
    }
    speed.select = { handler: summarise(handler), painted: summarise(painted) }
    return {
      ok: speed.select.handler.p95 <= 8 && speed.select.painted.worst <= 120 && seen.size > 1,
      note: 'p95 ' + speed.select.handler.p95 + 'ms, painted p95 ' + speed.select.painted.p95 + 'ms, worst ' + speed.select.painted.worst + 'ms, ' + seen.size + ' selections'
    }
  })

  await clear()

  return { checks, byType, records: shapes.length, speed, shapesOnScreen: painted }
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
  const shot = await win.webContents.capturePage()
  console.log('BOARD ' + JSON.stringify({ ...result, pixels: !shot.isEmpty(), errors: [...new Set(errors)].slice(0, 12) }))
  app.exit(0)
}).catch(error => {
  console.log('BOARD ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

const file = await boardFile()
const directory = await stage(file, mainSource)
try {
  const result = await run(await compile(directory))
  if (result.failed)
    throw new Error(`${result.failed}${result.errors?.length ? `\n${result.errors.join('\n')}` : ''}`)
  let heading = ''
  for (const check of result.checks) {
    if (check.section !== heading) {
      heading = check.section
      console.log(`\n${heading}`)
    }
    console.log(`  ${check.ok ? 'ok  ' : 'FAIL'}  ${check.name}${check.note ? `  (${check.note})` : ''}`)
  }
  const problems = result.checks.filter(check => !check.ok).map(check => `${check.name}${check.note ? `: ${check.note}` : ''}`)
  if (!result.pixels) problems.push('the window captured no pixels')
  for (const error of result.errors) problems.push(`window error: ${error}`)
  console.log(
    `\n${path.basename(file)}, ${result.records} shapes: ${Object.entries(result.byType)
      .map(([type, count]) => `${type} ${count}`)
      .join(', ')}`
  )
  for (const [name, run] of Object.entries(result.speed ?? {}))
    console.log(
      `${name.padEnd(8)} handler mean ${run.handler.mean}ms  p95 ${run.handler.p95}ms  worst ${run.handler.worst}ms, to frame p95 ${run.painted.p95}ms${
        run.commits ? `, commits ${run.commits.canvas} canvas ${run.commits.overlay} overlay ${run.commits.app} window` : ''
      }`
    )
  if (problems.length) throw new Error(`\n${problems.join('\n')}`)
  console.log(`\nall ${result.checks.length} checks passed`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
