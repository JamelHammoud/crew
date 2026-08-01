import { describe, expect, it, vi } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { SelectionManager } from '../src/renderer/src/canvas/editor/selection'
import { Box } from '../src/renderer/src/canvas/math'
import { createShapeId, createTLStore, fromPlainText, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { react } from '../src/renderer/src/canvas/signals'
import {
  ArrowShapeUtil,
  FrameShapeUtil,
  GeoShapeUtil,
  GroupShapeUtil,
  TextShapeUtil
} from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  return new Editor({
    store: createTLStore({ id: 'editor-test' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil],
    tools: [SelectTool],
    getContainer: () =>
      ({
        getBoundingClientRect: () => ({ left: 0, top: 0 })
      }) as HTMLElement
  })
}

function frame(subject: Editor, id: string, x: number, y: number, w = 100, h = 60): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'frame', x, y, props: { w, h, name: id, color: 'black' } })
  return shapeId
}

describe('the canvas editor', () => {
  it('keeps an unchanged selection quiet and selected-id readers independent of shape records', () => {
    const selection = new SelectionManager()
    const id = createShapeId('quiet')
    let selectionReads = 0
    const stopSelection = react('selection reads', () => {
      selection.getSelectedShapeIds()
      selectionReads++
    })
    selection.setSelectedShapeIds([id])
    selection.setSelectedShapeIds([id])
    expect(selectionReads).toBe(2)
    stopSelection()

    const subject = editor()
    frame(subject, 'quiet', 0, 0)
    subject.select(id)
    let editorReads = 0
    const stopEditor = react('editor selected ids', () => {
      subject.getSelectedShapeIds()
      editorReads++
    })
    subject.updateShape({ id, type: 'frame', x: 20 })
    expect(editorReads).toBe(1)
    stopEditor()
  })

  it('keeps page ordering and geometry cached until a shape changes', () => {
    const subject = editor()
    const id = frame(subject, 'cached', 0, 0)
    const geometry = vi.spyOn(FrameShapeUtil.prototype, 'getGeometry')
    const firstShapes = subject.getCurrentPageShapesSorted()
    const firstBounds = subject.getShapePageBounds(id)
    const calls = geometry.mock.calls.length
    expect(subject.getCurrentPageShapesSorted()).toBe(firstShapes)
    expect(subject.getShapePageBounds(id)).toBe(firstBounds)
    expect(geometry).toHaveBeenCalledTimes(calls)
    subject.select(id)
    expect(subject.getCurrentPageShapesSorted()).toBe(firstShapes)
    subject.updateShape({ id, type: 'frame', x: 20 })
    expect(subject.getCurrentPageShapesSorted()).not.toBe(firstShapes)
    expect(subject.getShapePageBounds(id)).not.toBe(firstBounds)
  })

  it('resolves overlays once on an idle pointer move', () => {
    const subject = editor()
    const overlayHit = vi.spyOn(subject.overlays, 'getOverlayAtPoint')
    const target = { closest: () => null }
    subject.getCanvasEventHandlers().onPointerMove({
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
      pressure: 0,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      target,
      currentTarget: null
    } as unknown as PointerEvent)
    expect(overlayHit).toHaveBeenCalledTimes(1)
  })

  it('creates, selects, updates, resizes and deletes shapes', () => {
    const subject = editor()
    const id = frame(subject, 'one', 10, 20)
    expect(subject.getShape(id)).toMatchObject({ x: 10, y: 20, parentId: subject.getCurrentPageId() })
    expect(subject.getShapePageBounds(id)?.toJson()).toEqual({ x: 10, y: 20, w: 100, h: 60 })
    subject
      .select(id)
      .nudgeShapes([id], { x: 5, y: -3 })
      .resizeShape(id, { x: 2, y: 0.5 }, { scaleOrigin: { x: 15, y: 17 } })
    expect(subject.getSelectedShapeIds()).toEqual([id])
    expect(subject.getShape(id)?.props).toMatchObject({ w: 200, h: 30 })
    subject.deleteShapes([id])
    expect(subject.getShape(id)).toBeUndefined()
    expect(subject.getSelectedShapeIds()).toEqual([])
  })

  it('converts camera coordinates and zooms to content', () => {
    const subject = editor()
    subject.setViewportScreenBounds({ x: 20, y: 30, w: 800, h: 600 })
    subject.setCamera({ x: 10, y: -5, z: 2 })
    expect(subject.pageToViewport({ x: 40, y: 25 })).toMatchObject({ x: 100, y: 40 })
    expect(subject.screenToPage({ x: 120, y: 70 })).toMatchObject({ x: 40, y: 25 })
    frame(subject, 'fit', 100, 100, 200, 100)
    subject.zoomToFit()
    expect(subject.getViewportPageBounds().contains(new Box(100, 100, 200, 100))).toBe(true)
  })

  it('holds culling steady during a pointer interaction and refreshes it on release', () => {
    const subject = editor()
    subject.setViewportScreenBounds({ x: 0, y: 0, w: 100, h: 100 })
    const id = frame(subject, 'culled-drag', 200, 0, 40, 40)
    expect(subject.getCulledShapes().has(id)).toBe(true)
    subject.inputs.pointerDown({ x: 10, y: 10 }, { x: 10, y: 10 }, {}, 'mouse')
    subject.updateShape({ id, type: 'frame', x: 20 })
    expect(subject.getCulledShapes().has(id)).toBe(true)
    subject.inputs.pointerUp({ x: 10, y: 10 }, { x: 10, y: 10 }, {})
    expect(subject.getCulledShapes().has(id)).toBe(false)
  })

  it('orders siblings without changing their relative selected order', () => {
    const subject = editor()
    const a = frame(subject, 'a', 0, 0)
    const b = frame(subject, 'b', 20, 0)
    const c = frame(subject, 'c', 40, 0)
    subject.bringForward([a])
    expect(subject.getSortedChildIdsForParent(subject.getCurrentPageId())).toEqual([b, a, c])
    subject.bringToFront([b, a])
    expect(subject.getSortedChildIdsForParent(subject.getCurrentPageId())).toEqual([c, b, a])
    subject.sendToBack([a])
    expect(subject.getSortedChildIdsForParent(subject.getCurrentPageId())).toEqual([a, c, b])
  })

  it('groups and ungroups while preserving page positions', () => {
    const subject = editor()
    const a = frame(subject, 'a', 10, 20)
    const b = frame(subject, 'b', 180, 90)
    const before = [subject.getShapePageBounds(a)?.toJson(), subject.getShapePageBounds(b)?.toJson()]
    const group = createShapeId('group')
    subject.groupShapes([a, b], group)
    expect(subject.getShape(group)?.type).toBe('group')
    expect(subject.getShape(a)?.parentId).toBe(group)
    expect([subject.getShapePageBounds(a)?.toJson(), subject.getShapePageBounds(b)?.toJson()]).toEqual(before)
    subject.ungroupShapes([group])
    expect(subject.getShape(group)).toBeUndefined()
    expect(subject.getShape(a)?.parentId).toBe(subject.getCurrentPageId())
    expect([subject.getShapePageBounds(a)?.toJson(), subject.getShapePageBounds(b)?.toJson()]).toEqual(before)
  })

  it('resizes selected groups through their leaf shapes', () => {
    const subject = editor()
    const a = frame(subject, 'group-a', 10, 20, 100, 60)
    const b = frame(subject, 'group-b', 180, 90, 80, 40)
    const group = createShapeId('resize-group')
    subject.groupShapes([a, b], group)
    subject.select(group)
    const before = subject.getSelectionRotatedPageBounds()!
    const origin = { x: before.maxX, y: before.maxY }
    const current = { x: before.maxX + 100, y: before.maxY + 80 }
    subject.inputs.pointerDown(origin, origin, {}, 'mouse')
    subject.inputs.pointerMove(current, current, {})
    subject.setCurrentTool('select.resizing', { handle: 'bottom_right' })
    const after = subject.getSelectionRotatedPageBounds()!
    expect(after.w).toBeGreaterThan(before.w)
    expect(after.h).toBeGreaterThan(before.h)
    const resizedA = subject.getShape(a)
    const resizedB = subject.getShape(b)
    expect(resizedA?.type).toBe('frame')
    expect(resizedB?.type).toBe('frame')
    if (resizedA?.type !== 'frame' || resizedB?.type !== 'frame') throw new Error('Expected frame children')
    expect(resizedA.props.w).toBeGreaterThan(100)
    expect(resizedB.props.w).toBeGreaterThan(80)
  })

  it('copies descendants, remaps ids and pastes at a point', () => {
    const subject = editor()
    const id = frame(subject, 'copy', 10, 20, 40, 30)
    const content = subject.getContentFromCurrentPage([id])
    expect(content?.rootShapeIds).toEqual([id])
    subject.putContentOntoCurrentPage(content!, { point: { x: 300, y: 200 }, select: true })
    const pasted = subject.getOnlySelectedShape()
    expect(pasted?.id).not.toBe(id)
    expect(subject.getShapePageBounds(pasted!.id)?.center).toMatchObject({ x: 300, y: 200 })
  })

  it('uses the exact canvas theme values Crew reads', () => {
    const subject = editor()
    expect(subject.getCurrentTheme()).toMatchObject({ id: 'default', fontSize: 16, lineHeight: 1.35, strokeWidth: 2 })
    expect(subject.getCurrentTheme().colors.light.selectionStroke).toBe('hsl(214, 84%, 56%)')
    expect(subject.getCurrentTheme().colors.light.blue).toMatchObject({ solid: '#4465e9', fill: '#4465e9' })
    expect(subject.getCurrentTheme().colors.light.orange).toMatchObject({
      noteFill: '#FAA475',
      frameStroke: '#e68544',
      highlightSrgb: '#ffa500'
    })
    subject.user.updateUserPreferences({ colorScheme: 'dark' })
    expect(subject.getColorMode()).toBe('dark')
    expect(subject.getCurrentTheme().colors.dark['light-blue']).toMatchObject({ solid: '#4dabf7', fill: '#4dabf7' })
    expect(subject.getCurrentTheme().colors.dark.violet).toMatchObject({
      noteFill: '#5f1c70',
      frameFill: '#1b0f21',
      highlightSrgb: '#9e00ee'
    })
  })

  it('exports selected shapes from the current document snapshot', async () => {
    const subject = editor()
    const id = frame(subject, 'export', 10, 20, 40, 30)
    await expect(subject.getSvgString([])).resolves.toBeUndefined()
    const result = await subject.getSvgString([id], { padding: 0, scale: 2 })
    expect(result).toMatchObject({ width: 80, height: 116 })
    expect(result?.svg).toContain(`data-shape-id="${id}"`)
    const image = await subject.toImage([id], { format: 'svg', padding: 0 })
    expect(image).toMatchObject({ width: 40, height: 58 })
    expect(image.blob.type).toBe('image/svg+xml')
    expect(await image.blob.text()).toContain(`data-shape-id="${id}"`)
  })

  it('routes shape pointer events into selection and translation tools', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'event-test' }),
      shapeUtils: [FrameShapeUtil, GroupShapeUtil],
      tools: [SelectTool],
      getContainer: () =>
        ({
          focus: () => undefined,
          getBoundingClientRect: () => ({ left: 0, top: 0 })
        }) as HTMLElement
    })
    const id = frame(subject, 'drag', 0, 0, 100, 60)
    const shapeElement = {
      dataset: { shapeId: id },
      closest: (selector: string) => (selector === '[data-shape-id]' ? shapeElement : null)
    }
    const pointer = (x: number, buttons: number) =>
      ({
        clientX: x,
        clientY: 10,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons,
        pressure: buttons ? 0.5 : 0,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        target: shapeElement,
        currentTarget: null
      }) as unknown as PointerEvent
    const handlers = subject.getCanvasEventHandlers()
    handlers.onPointerDown(pointer(10, 1))
    expect(subject.getSelectedShapeIds()).toEqual([id])
    handlers.onPointerMove(pointer(30, 1))
    handlers.onPointerUp(pointer(30, 0))
    expect(subject.getShape(id)?.x).toBe(20)
  })

  it('routes point and gap snaps through the editor and exposes their overlay', () => {
    const subject = editor()
    const result = subject.snaps.snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 100, 60),
      dragDelta: { x: 7, y: 0 },
      snappableShapes: [{ id: 'shape:target', pageBounds: new Box(110, 0, 100, 60) }]
    })
    expect(result.nudge).toMatchObject({ x: 3, y: 0 })
    expect(result.indicators.some(indicator => indicator.type === 'points')).toBe(true)
    subject.snaps.setIndicators(result.indicators)
    const entry = subject.overlays
      .getActiveOverlayEntries()
      .find(candidate => candidate.util === subject.overlays.getOverlayUtil('snap_indicator'))
    expect(entry?.overlays).toHaveLength(result.indicators.length)
    subject.snaps.clearIndicators()
    expect(subject.overlays.getOverlayUtil('snap_indicator').isActive()).toBe(false)
  })

  it('keeps resize targets out of a short text selection and restores the horizontal edges when large enough', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'text-overlay-test' }),
      shapeUtils: [TextShapeUtil],
      tools: [SelectTool],
      getContainer: () => document.body
    })
    const id = createShapeId('short-text')
    subject.createShape({
      id,
      type: 'text',
      x: 20,
      y: 30,
      props: { richText: fromPlainText('Crew'), autoSize: false, w: 200 }
    })
    subject.select(id)
    subject.setCamera({ x: 0, y: 0, z: 0.15 })
    const shortBounds = subject.getShapePageBounds(id)!
    expect(subject.overlays.getOverlayAtPoint(shortBounds.center)).toBeNull()
    const smallHandles = subject.overlays
      .getActiveOverlayEntries()
      .flatMap(entry => entry.overlays)
      .filter(overlay => overlay.type === 'selection_foreground')
      .map(overlay => (overlay.props as { handle: string }).handle)
    expect(smallHandles).toEqual(['top_left', 'bottom_right'])

    subject.setCamera({ x: 0, y: 0, z: 1 })
    const largeBounds = subject.getShapePageBounds(id)!
    const right = subject.overlays.getOverlayAtPoint({ x: largeBounds.maxX, y: largeBounds.center.y })
    expect((right?.props as { handle?: string } | undefined)?.handle).toBe('right')
  })

  it('binds arrow terminals to shapes and exposes editable arrow handles', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'binding-test' }),
      shapeUtils: [GeoShapeUtil, ArrowShapeUtil],
      getContainer: () => document.body
    })
    const targetId = createShapeId('target')
    const arrowId = createShapeId('arrow')
    subject.createShape({ id: targetId, type: 'geo', x: 100, y: 20, props: { w: 120, h: 80 } })
    subject.createShape({ id: arrowId, type: 'arrow', x: 0, y: 50, props: { end: { x: 120, y: 0 } } })
    const arrow = subject.getShape(arrowId)
    expect(arrow?.type).toBe('arrow')
    subject.bindArrowTerminal(arrow as Extract<typeof arrow, { type: 'arrow' }>, 'end', { x: 120, y: 50 }, true)
    expect(subject.getBindingsFromShape(arrowId, 'arrow')).toEqual([
      expect.objectContaining({ fromId: arrowId, toId: targetId, props: expect.objectContaining({ terminal: 'end' }) })
    ])
    subject.select(arrowId)
    expect(subject.overlays.getOverlayUtil('shape_handle').isActive()).toBe(true)
    expect(
      subject.overlays
        .getActiveOverlayEntries()
        .flatMap(entry => entry.overlays)
        .filter(value => value.type === 'shape_handle')
    ).toHaveLength(3)
  })
})
