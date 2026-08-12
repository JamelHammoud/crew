import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { boardFile, byShapeCount, compile, root, run, stage } from './board-window.mjs'

const shots = path.join(root, 'out', 'snap-check')

const probeSource = `(() => {
  const editor = window.canvasEditor
  if (!editor) return 'no editor'

  const surface = document.querySelector('[data-canvas="true"]')
  const overlay = document.querySelector('[data-canvas-overlays="true"]')
  const nodeOf = id => document.querySelector('[data-shape-id="' + id + '"][data-canvas-shape="true"]')
  const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
  const settle = async times => {
    for (let at = 0; at < (times || 4); at++) await frame()
  }
  const round = value => Math.round(value * 1e6) / 1e6

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
        shiftKey: Boolean(modifiers && modifiers.shiftKey),
        altKey: Boolean(modifiers && modifiers.altKey),
        ctrlKey: Boolean(modifiers && modifiers.ctrlKey),
        metaKey: Boolean(modifiers && modifiers.metaKey)
      })
    )

  const keyEvent = (name, key, code, modifiers) =>
    surface.dispatchEvent(
      new KeyboardEvent(name, {
        bubbles: true,
        cancelable: true,
        key,
        code,
        shiftKey: Boolean(modifiers && modifiers.shiftKey),
        altKey: Boolean(modifiers && modifiers.altKey),
        ctrlKey: Boolean(modifiers && modifiers.ctrlKey),
        metaKey: Boolean(modifiers && modifiers.metaKey)
      })
    )

  const statePath = () => {
    const parts = []
    let node = editor.root
    while (node && parts.length < 8) {
      const next = node.getCurrent ? node.getCurrent() : null
      if (!next) break
      parts.push(next.constructor && next.constructor.id ? next.constructor.id : '?')
      node = next
    }
    return parts.join('.')
  }

  const hold = async (from, to, options) => {
    const settings = options || {}
    const after = settings.pressAfter || {}
    const none = {}
    pointer('pointerdown', from.x, from.y, 1, settings.target, none)
    await frame()
    const steps = settings.steps || 14
    const pressAt = settings.pressAt === undefined ? 4 : settings.pressAt
    let mods = none
    for (let step = 1; step <= steps; step++) {
      if (step === pressAt && after.metaKey) {
        mods = after
        keyEvent('keydown', 'Meta', 'MetaLeft', mods)
        await frame()
      }
      const along = step / steps
      pointer('pointermove', from.x + (to.x - from.x) * along, from.y + (to.y - from.y) * along, 1, undefined, mods)
      await frame()
    }
    for (let still = 0; still < 10; still++) {
      pointer('pointermove', to.x, to.y, 1, undefined, mods)
      await frame()
    }
    return mods
  }

  const letGo = async (at, modifiers) => {
    const mods = modifiers || {}
    pointer('pointerup', at.x, at.y, 0, undefined, mods)
    keyEvent('keyup', 'Meta', 'MetaLeft', {})
    keyEvent('keyup', 'Control', 'ControlLeft', {})
    pointer('pointermove', at.x, at.y, 0, undefined, {})
    await settle(4)
  }

  const view = point => {
    const at = editor.pageToViewport(point)
    const rect = editor.getContainer().getBoundingClientRect()
    return { x: at.x + rect.left, y: at.y + rect.top }
  }
  const boundsOf = id => editor.getShapePageBounds(id)
  const madeHere = []

  const put = partial => {
    const before = new Set(editor.getCurrentPageShapes().map(shape => shape.id))
    editor.createShape(partial)
    const made = editor.getCurrentPageShapes().find(shape => !before.has(shape.id))
    if (made) madeHere.push(made.id)
    return made ? made.id : null
  }

  const box = (x, y, w, h, parentId) => {
    const partial = {
      type: 'geo',
      x,
      y,
      props: { w, h, geo: 'rectangle', fill: 'solid', dash: 'solid', color: 'blue', size: 's' }
    }
    if (parentId) partial.parentId = parentId
    return put(partial)
  }

  const clear = async () => {
    if (madeHere.length) editor.deleteShapes(madeHere.slice())
    madeHere.length = 0
    editor.selectNone()
    await settle(2)
  }

  const room = async zoom => {
    await clear()
    const all = editor.getCurrentPageBounds()
    const spot = { x: (all ? all.maxX : 0) + 6000, y: all ? all.center.y : 0 }
    const camera = editor.getCamera()
    editor.setCamera({ x: camera.x, y: camera.y, z: zoom }, { immediate: true })
    editor.centerOnPoint(spot, { immediate: true })
    await settle(4)
    return editor.getViewportPageBounds()
  }

  const featureOf = (bounds, axis, edge) => {
    if (axis === 'x') return edge === 'min' ? bounds.minX : edge === 'mid' ? bounds.center.x : bounds.maxX
    return edge === 'min' ? bounds.minY : edge === 'mid' ? bounds.center.y : bounds.maxY
  }

  const featuresOf = (bounds, axis) => [
    featureOf(bounds, axis, 'min'),
    featureOf(bounds, axis, 'mid'),
    featureOf(bounds, axis, 'max')
  ]

  const fairness = (moverBounds, anchorBounds, axis, moverEdge, anchorEdge, shift) => {
    const wanted = Math.abs(
      featureOf(moverBounds, axis, moverEdge) + shift - featureOf(anchorBounds, axis, anchorEdge)
    )
    let nearest = Infinity
    let count = 0
    for (const mine of featuresOf(moverBounds, axis)) {
      for (const theirs of featuresOf(anchorBounds, axis)) {
        const offset = Math.abs(mine + shift - theirs)
        if (offset < nearest - 1e-6) {
          nearest = offset
          count = 1
        } else if (Math.abs(offset - nearest) <= 1e-6) count++
      }
    }
    return { fair: Math.abs(nearest - wanted) < 1e-6 && count === 1, nearest: round(nearest), wanted: round(wanted) }
  }

  const crossFree = (moverBounds, anchorBounds, axis, threshold) => {
    let nearest = Infinity
    for (const mine of featuresOf(moverBounds, axis)) {
      for (const theirs of featuresOf(anchorBounds, axis)) nearest = Math.min(nearest, Math.abs(mine - theirs))
    }
    return { free: nearest > threshold, nearest: round(nearest) }
  }

  const redPixels = () => {
    const context = overlay && overlay.getContext('2d')
    if (!context) return null
    const data = context.getImageData(0, 0, overlay.width, overlay.height).data
    const columns = new Map()
    const rows = new Map()
    let count = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let at = 0; at < data.length; at += 4) {
      const red = data[at]
      const green = data[at + 1]
      const blue = data[at + 2]
      const alpha = data[at + 3]
      if (alpha < 40 || red < 120 || red - green < 45 || red - blue < 45) continue
      const pixel = at / 4
      const x = pixel % overlay.width
      const y = Math.floor(pixel / overlay.width)
      count++
      columns.set(x, (columns.get(x) || 0) + 1)
      rows.set(y, (rows.get(y) || 0) + 1)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    if (count === 0) return { count: 0, thickness: 0, run: 0, width: overlay.width, height: overlay.height }
    const spread = (tally, along) => {
      let best = 0
      let bestAt = 0
      for (const [at, total] of tally) {
        if (total > best) {
          best = total
          bestAt = at
        }
      }
      let thickness = 0
      for (let step = 0; ; step++) {
        const total = tally.get(bestAt + step) || 0
        if (total < best * 0.5) break
        thickness++
      }
      for (let step = 1; ; step++) {
        const total = tally.get(bestAt - step) || 0
        if (total < best * 0.5) break
        thickness++
      }
      return { thickness, run: best, at: bestAt, along }
    }
    const down = spread(columns, 'vertical')
    const across = spread(rows, 'horizontal')
    const guide = down.run >= across.run ? down : across
    return {
      count,
      thickness: guide.thickness,
      run: guide.run,
      along: guide.along,
      dpr: window.devicePixelRatio,
      box: { minX, minY, maxX, maxY },
      width: overlay.width,
      height: overlay.height
    }
  }

  const indicators = () =>
    editor.snaps.getIndicators().map(indicator => ({
      id: indicator.id,
      type: indicator.type,
      points: indicator.type === 'points' ? indicator.points.map(point => ({ x: round(point.x), y: round(point.y) })) : [],
      gaps: indicator.type === 'gaps' ? indicator.gaps.length : 0
    }))

  const descendants = id => {
    const found = []
    const walk = parent => {
      for (const child of editor.getSortedChildIdsForParent(parent)) {
        found.push(child)
        walk(child)
      }
    }
    walk(id)
    return found
  }

  const EDGES = [
    { name: 'left edge to left edge', axis: 'x', mover: 'min', anchor: 'min' },
    { name: 'centre to centre', axis: 'x', mover: 'mid', anchor: 'mid' },
    { name: 'right edge to left edge', axis: 'x', mover: 'max', anchor: 'min' },
    { name: 'top edge to top edge', axis: 'y', mover: 'min', anchor: 'min' },
    { name: 'middle to middle', axis: 'y', mover: 'mid', anchor: 'mid' },
    { name: 'bottom edge to top edge', axis: 'y', mover: 'max', anchor: 'min' }
  ]

  const checks = []
  const say = (name, ok, note) => checks.push({ name, ok: Boolean(ok), note: note === undefined ? '' : String(note) })

  const edgeCase = async spec => {
    const centre = (await room(1)).center
    const anchor = box(Math.round(centre.x - 260), Math.round(centre.y - 170), 120, 90)
    const mover =
      spec.axis === 'x'
        ? box(Math.round(centre.x + 120), Math.round(centre.y + 90), 80, 60)
        : box(Math.round(centre.x + 180), Math.round(centre.y + 120), 80, 60)
    await settle(4)
    if (!anchor || !mover) return { ok: false, note: 'harness: the fixtures were not created' }
    const anchorAt = boundsOf(anchor)
    const moverAt = boundsOf(mover)
    const snappable = editor.getSnappableShapes().map(shape => shape.id)
    if (!snappable.includes(anchor))
      return { ok: false, note: 'harness: the anchor is not a snap target, ' + snappable.length + ' are' }

    const want = featureOf(anchorAt, spec.axis, spec.anchor) - featureOf(moverAt, spec.axis, spec.mover)
    const off = 4
    const shift = spec.axis === 'x' ? { x: want - off, y: 0 } : { x: 0, y: want - off }
    const fair = fairness(moverAt, anchorAt, spec.axis, spec.mover, spec.anchor, spec.axis === 'x' ? shift.x : shift.y)
    if (!fair.fair)
      return {
        ok: false,
        note:
          'harness: the pair asked for is not the nearest, wanted ' + fair.wanted + ' but nearest is ' + fair.nearest
      }
    const other = crossFree(moverAt, anchorAt, spec.axis === 'x' ? 'y' : 'x', 8)

    editor.select(mover)
    await settle(3)
    const from = view(moverAt.center)
    const to = view({ x: moverAt.center.x + shift.x, y: moverAt.center.y + shift.y })
    await hold(from, to, { target: nodeOf(mover) })
    const live = indicators()
    await letGo(to)
    const landed = boundsOf(mover)
    if (!landed) return { ok: false, note: 'harness: the shape vanished' }
    const moved = Math.abs(featureOf(landed, spec.axis, spec.mover) - featureOf(moverAt, spec.axis, spec.mover))
    if (moved < 1) return { ok: false, note: 'harness: the drag never moved the shape' }
    const gap = round(featureOf(landed, spec.axis, spec.mover) - featureOf(anchorAt, spec.axis, spec.anchor))
    return {
      ok: Math.abs(gap) < 0.01 && live.length > 0,
      note:
        'off by ' + gap + ' page units, unsnapped would be ' + -off + ', ' + live.length + ' indicators, cross axis clear by ' + other.nearest
    }
  }

  const attempt = async (name, task) => {
    try {
      const result = await task()
      if (result === null) return
      say(name, result.ok !== false, result.note)
    } catch (error) {
      say(name, false, 'harness: threw ' + (error && error.message ? error.message : error))
    }
    await clear()
  }

  window.snapProbe = {
    async checks() {
      const held = []
      for (const spec of EDGES) await attempt(spec.name, () => edgeCase(spec))

      await attempt('the guide is painted on the overlay', async () => {
        const centre = (await room(1)).center
        const anchor = box(Math.round(centre.x - 200), Math.round(centre.y - 140), 120, 90)
        const mover = box(Math.round(centre.x + 140), Math.round(centre.y + 80), 80, 60)
        await settle(4)
        const anchorAt = boundsOf(anchor)
        const moverAt = boundsOf(mover)
        const want = anchorAt.minX - moverAt.minX
        editor.select(mover)
        await settle(3)
        const from = view(moverAt.center)
        const to = view({ x: moverAt.center.x + want - 4, y: moverAt.center.y })
        await hold(from, to, { target: nodeOf(mover) })
        const live = indicators()
        const pixels = redPixels()
        held.push({ stage: 'painted', indicators: live.length, pixels })
        await letGo(to)
        if (!pixels) return { ok: false, note: 'harness: there is no overlay canvas to read' }
        return {
          ok: live.length > 0 && pixels.count > 0,
          note:
            live.length +
            ' indicators, ' +
            pixels.count +
            ' red pixels on the overlay, ' +
            pixels.along +
            ' guide ' +
            pixels.thickness +
            ' device px thick at dpr ' +
            pixels.dpr
        }
      })

      await attempt('no guide is painted when nothing is near', async () => {
        const centre = (await room(1)).center
        const anchor = box(Math.round(centre.x - 400), Math.round(centre.y - 300), 120, 90)
        const mover = box(Math.round(centre.x + 140), Math.round(centre.y + 80), 80, 60)
        await settle(4)
        const moverAt = boundsOf(mover)
        editor.select(mover)
        await settle(3)
        const from = view(moverAt.center)
        const to = view({ x: moverAt.center.x + 37, y: moverAt.center.y + 23 })
        await hold(from, to, { target: nodeOf(mover) })
        const live = indicators()
        const pixels = redPixels()
        await letGo(to)
        const landed = boundsOf(mover)
        return {
          ok: live.length === 0 && pixels.count === 0 && Math.abs(landed.minX - moverAt.minX - 37) < 0.01,
          note:
            live.length + ' indicators, ' + pixels.count + ' red pixels, moved ' + round(landed.minX - moverAt.minX) + ' of 37, anchor ' + (anchor ? 'placed' : 'missing')
        }
      })

      await attempt('a frame does not snap to its own children', async () => {
        const centre = (await room(1)).center
        const outer = put({
          type: 'frame',
          x: Math.round(centre.x - 150),
          y: Math.round(centre.y - 100),
          props: { w: 320, h: 220, name: '' }
        })
        if (!outer) return { ok: false, note: 'harness: no frame was created' }
        const inner = box(3, 20, 140, 100, outer)
        await settle(4)
        if (!inner) return { ok: false, note: 'harness: no child was created' }
        const frameAt = boundsOf(outer)
        const childAt = boundsOf(inner)
        const inset = round(childAt.minX - frameAt.minX)
        if (!(inset > 0 && inset < 8))
          return { ok: false, note: 'harness: the child sits ' + inset + ' from the frame edge, outside the 8 unit threshold' }
        editor.select(outer)
        await settle(3)
        const kin = descendants(outer)
        const snappable = editor.getSnappableShapes().map(shape => shape.id)
        const own = kin.filter(id => snappable.includes(id))
        const from = view(frameAt.center)
        const to = view({ x: frameAt.center.x + 41, y: frameAt.center.y + 27 })
        await hold(from, to, { target: nodeOf(outer) })
        const live = indicators()
        await letGo(to)
        const landed = boundsOf(outer)
        const drift = { x: round(landed.minX - frameAt.minX - 41), y: round(landed.minY - frameAt.minY - 27) }
        return {
          ok: own.length === 0 && live.length === 0 && Math.abs(drift.x) < 0.01 && Math.abs(drift.y) < 0.01,
          note:
            own.length +
            ' of its ' +
            kin.length +
            ' children are snap targets, ' +
            live.length +
            ' indicators, landed ' +
            drift.x +
            ' and ' +
            drift.y +
            ' off the pointer, child inset ' +
            inset
        }
      })

      await attempt('a frame still snaps to a shape it does not own', async () => {
        const centre = (await room(1)).center
        const outer = put({
          type: 'frame',
          x: Math.round(centre.x + 40),
          y: Math.round(centre.y - 260),
          props: { w: 320, h: 220, name: '' }
        })
        if (!outer) return { ok: false, note: 'harness: no frame was created' }
        const inner = box(3, 20, 140, 100, outer)
        await settle(4)
        if (!inner) return { ok: false, note: 'harness: no child was created' }
        const frameAt = boundsOf(outer)
        const stranger = box(Math.round(frameAt.minX - 300), Math.round(frameAt.minY + 400), 120, 90)
        await settle(4)
        if (!stranger) return { ok: false, note: 'harness: no stranger was created' }
        const strangerAt = boundsOf(stranger)
        const want = strangerAt.minX - frameAt.minX
        const off = 4
        const fair = fairness(frameAt, strangerAt, 'x', 'min', 'min', want - off)
        if (!fair.fair)
          return { ok: false, note: 'harness: the pair asked for is not the nearest, nearest is ' + fair.nearest }
        editor.select(outer)
        await settle(3)
        const from = view(frameAt.center)
        const to = view({ x: frameAt.center.x + want - off, y: frameAt.center.y })
        await hold(from, to, { target: nodeOf(outer) })
        const live = indicators()
        await letGo(to)
        const landed = boundsOf(outer)
        const gap = round(landed.minX - strangerAt.minX)
        return {
          ok: Math.abs(gap) < 0.01 && live.length > 0,
          note: 'off by ' + gap + ', unsnapped would be ' + -off + ', ' + live.length + ' indicators'
        }
      })

      await attempt('equal spacing snaps to the same gap', async () => {
        const centre = (await room(1)).center
        const left = Math.round(centre.x - 300)
        const top = Math.round(centre.y - 40)
        const first = box(left, top, 60, 60)
        const second = box(left + 100, top, 60, 60)
        const third = box(left + 200, top, 60, 60)
        const mover = box(left + 400, top, 60, 60)
        await settle(4)
        if (!first || !second || !third || !mover) return { ok: false, note: 'harness: the row was not created' }
        const thirdAt = boundsOf(third)
        const moverAt = boundsOf(mover)
        const rhythm = round(boundsOf(second).minX - boundsOf(first).maxX)
        const target = thirdAt.maxX + rhythm
        const off = 4
        const shift = target + off - moverAt.minX
        editor.select(mover)
        await settle(3)
        const from = view(moverAt.center)
        const to = view({ x: moverAt.center.x + shift, y: moverAt.center.y })
        await hold(from, to, { target: nodeOf(mover) })
        const live = indicators()
        const pixels = redPixels()
        await letGo(to)
        const landed = boundsOf(mover)
        const gap = round(landed.minX - thirdAt.maxX)
        const gaps = live.filter(indicator => indicator.type === 'gaps').length
        return {
          ok: Math.abs(gap - rhythm) < 0.01 && gaps > 0,
          note:
            'landed on a gap of ' +
            gap +
            ' against a rhythm of ' +
            rhythm +
            ', unsnapped would be ' +
            round(rhythm + off) +
            ', ' +
            gaps +
            ' gap indicators of ' +
            live.length +
            ', ' +
            pixels.count +
            ' red pixels'
        }
      })

      await attempt('the accelerator key suppresses snapping', async () => {
        const centre = (await room(1)).center
        const anchor = box(Math.round(centre.x - 200), Math.round(centre.y - 140), 120, 90)
        const mover = box(Math.round(centre.x + 140), Math.round(centre.y + 80), 80, 60)
        await settle(4)
        const anchorAt = boundsOf(anchor)
        const moverAt = boundsOf(mover)
        const want = anchorAt.minX - moverAt.minX
        const off = 4
        editor.select(mover)
        await settle(3)
        const from = view(moverAt.center)
        const to = view({ x: moverAt.center.x + want - off, y: moverAt.center.y })
        await hold(from, to, { target: nodeOf(mover), pressAfter: { metaKey: true } })
        const live = indicators()
        const pixels = redPixels()
        const where = statePath()
        const accel = editor.inputs.getAccelKey()
        await letGo(to, { metaKey: true })
        const landed = boundsOf(mover)
        const drift = round(landed.minX - (moverAt.minX + want - off))
        return {
          ok: live.length === 0 && pixels.count === 0 && Math.abs(drift) < 0.01,
          note:
            'landed ' +
            drift +
            ' from where the pointer put it, ' +
            round(landed.minX - anchorAt.minX) +
            ' from the anchor edge, ' +
            live.length +
            ' indicators, ' +
            pixels.count +
            ' red pixels, in ' +
            where +
            ', accel ' +
            accel
        }
      })

      await attempt('snapping still works after the accelerator is let go', async () => {
        const centre = (await room(1)).center
        const anchor = box(Math.round(centre.x - 200), Math.round(centre.y - 140), 120, 90)
        const mover = box(Math.round(centre.x + 140), Math.round(centre.y + 80), 80, 60)
        await settle(4)
        const anchorAt = boundsOf(anchor)
        const moverAt = boundsOf(mover)
        const want = anchorAt.minX - moverAt.minX
        editor.select(mover)
        await settle(3)
        const from = view(moverAt.center)
        const to = view({ x: moverAt.center.x + want - 4, y: moverAt.center.y })
        await hold(from, to, { target: nodeOf(mover) })
        await letGo(to)
        const landed = boundsOf(mover)
        return { ok: Math.abs(landed.minX - anchorAt.minX) < 0.01, note: 'off by ' + round(landed.minX - anchorAt.minX) }
      })

      await clear()
      return { checks, held, zoom: editor.getZoomLevel() }
    },

    async pose(zoom) {
      for (let go = 1; go <= 3; go++) {
        const centre = (await room(zoom)).center
        const anchor = box(Math.round(centre.x - 260), Math.round(centre.y - 160), 200, 140)
        const mover = box(Math.round(centre.x + 60), Math.round(centre.y + 40), 140, 100)
        await settle(5)
        const anchorAt = boundsOf(anchor)
        const moverAt = boundsOf(mover)
        const want = anchorAt.minX - moverAt.minX
        const off = zoom >= 1 ? 2 : 4
        editor.select(mover)
        await settle(3)
        const from = view(moverAt.center)
        const to = view({ x: moverAt.center.x + want - off, y: moverAt.center.y })
        this.at = to
        await hold(from, to, { target: nodeOf(mover) })
        const live = indicators()
        const pixels = redPixels()
        const landed = boundsOf(mover)
        const aligned = landed ? Math.abs(landed.minX - anchorAt.minX) < 0.01 : false
        if ((live.length === 0 || pixels.count === 0 || !aligned) && go < 3) {
          await letGo(to)
          await clear()
          continue
        }
        const held = editor.getViewportPageBounds()
        const topLeft = view({ x: Math.min(anchorAt.minX, landed.minX), y: Math.min(anchorAt.minY, landed.minY) })
        const bottomRight = view({ x: Math.max(anchorAt.maxX, landed.maxX), y: Math.max(anchorAt.maxY, landed.maxY) })
        return {
          zoom: editor.getZoomLevel(),
          indicators: live.length,
          aligned,
          tries: go,
          where: statePath(),
          pixels,
          viewport: { w: round(held.width), h: round(held.height) },
          crop: {
            x: Math.max(0, Math.round(topLeft.x) - 50),
            y: Math.max(0, Math.round(topLeft.y) - 50),
            width: Math.round(bottomRight.x - topLeft.x) + 100,
            height: Math.round(bottomRight.y - topLeft.y) + 100
          }
        }
      }
      return { zoom, indicators: 0, aligned: false, tries: 3, where: statePath(), pixels: redPixels(), crop: { x: 0, y: 0, width: 400, height: 400 } }
    },

    async release() {
      await letGo(this.at || { x: 0, y: 0 })
      editor.setCurrentTool('select')
      await clear()
      return statePath()
    }
  }
  return 'ready'
})()`

const mainSource = `const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const shots = ${JSON.stringify(shots)}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  const errors = []
  const win = new BrowserWindow({ width: 1600, height: 1000, show: true, webPreferences: { backgroundThrottling: false } })
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2 && !String(message).includes('willReadFrequently')) errors.push(String(message).slice(0, 200))
  })
  await win.loadFile(path.join(__dirname, 'dist/index.html'))
  for (let at = 0; at < 300; at++) {
    const ready = await win.webContents.executeJavaScript('Boolean(window.canvasReady)').catch(() => false)
    if (ready) break
    await wait(50)
  }
  await wait(900)
  const js = source => win.webContents.executeJavaScript(source)
  let result = null
  try {
    const installed = await js(${JSON.stringify(probeSource)})
    if (installed !== 'ready') throw new Error('the probe did not install: ' + installed)
    result = await js('window.snapProbe.checks()')
    const pictures = []
    for (const zoom of [0.25, 2]) {
      const posed = await js('window.snapProbe.pose(' + zoom + ')')
      const name = 'guides-at-' + String(Math.round(zoom * 100)) + '-percent'
      const whole = path.join(shots, name + '.png')
      fs.writeFileSync(whole, (await win.webContents.capturePage()).toPNG())
      const close = path.join(shots, name + '-close.png')
      fs.writeFileSync(close, (await win.webContents.capturePage(posed.crop)).toPNG())
      pictures.push({ ...posed, whole, close })
      await js('window.snapProbe.release()')
    }
    result.pictures = pictures
  } catch (error) {
    result = { failed: String((error && error.stack) || error) }
  }
  const shot = await win.webContents.capturePage()
  console.log('SNAP ' + JSON.stringify({ ...result, painted: !shot.isEmpty(), errors: [...new Set(errors)].slice(0, 12) }))
  app.exit(0)
}).catch(error => {
  console.log('SNAP ' + JSON.stringify({ failed: String((error && error.stack) || error) }))
  app.exit(1)
})
`

await mkdir(shots, { recursive: true })
const file = await boardFile(byShapeCount)
const directory = await stage(file, mainSource)
try {
  const result = await run(await compile(directory), 'SNAP')
  if (result.failed)
    throw new Error(`${result.failed}${result.errors?.length ? `\n${result.errors.join('\n')}` : ''}`)
  for (const check of result.checks)
    console.log(`${check.ok ? 'ok  ' : 'FAIL'}  ${check.name}${check.note ? `  (${check.note})` : ''}`)
  console.log('')
  for (const picture of result.pictures ?? []) {
    const thickness = picture.pixels?.thickness ?? 0
    const dpr = picture.pixels?.dpr ?? 1
    console.log(
      `at ${Math.round(picture.zoom * 100)}%: ${picture.indicators} indicators, ${picture.pixels?.count ?? 0} red pixels, guide ${thickness} device px (${(thickness / dpr).toFixed(2)} css px), landed aligned ${picture.aligned}, ${picture.tries} tries, in ${picture.where}`
    )
    console.log(`  ${picture.whole}`)
    console.log(`  ${picture.close}`)
  }
  const widths = (result.pictures ?? []).map(picture => (picture.pixels?.thickness ?? 0) / (picture.pixels?.dpr ?? 1))
  const problems = result.checks.filter(check => !check.ok).map(check => `${check.name}: ${check.note}`)
  if (widths.length === 2 && widths.every(width => width > 0)) {
    const ratio = Math.max(...widths) / Math.min(...widths)
    console.log(`\nthe guide is ${widths.map(width => width.toFixed(2)).join(' and ')} css px wide, a ratio of ${ratio.toFixed(2)}`)
    if (ratio > 2) problems.push(`the guide changes width with zoom, ${ratio.toFixed(2)} times over`)
  } else if (widths.length === 2) problems.push('no guide was painted at one of the two zooms')
  if (!result.painted) problems.push('the window captured no pixels')
  for (const error of result.errors ?? []) problems.push(`window error: ${error}`)
  console.log(`\n${path.basename(file)}, ${result.checks.length} checks`)
  if (problems.length) throw new Error(`\n${problems.join('\n')}`)
  console.log(`all ${result.checks.length} checks passed`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
