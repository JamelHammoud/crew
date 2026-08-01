import type { CanvasEventInfo } from '../tools/state/events'
import type { Editor } from './Editor'
import { handleShortcut } from './shortcuts'

export interface CanvasEventHandlers {
  onPointerDown(event: PointerEvent): void
  onPointerMove(event: PointerEvent): void
  onPointerUp(event: PointerEvent): void
  onPointerCancel(event: PointerEvent): void
  onDoubleClick(event: MouseEvent): void
  onContextMenu(event: MouseEvent): void
  onWheel(event: WheelEvent): void
  onKeyDown(event: KeyboardEvent): void
  onKeyUp(event: KeyboardEvent): void
  onTouchStart(event: TouchEvent): void
  onTouchMove(event: TouchEvent): void
  onTouchEnd(event: TouchEvent): void
  onTouchCancel(event: TouchEvent): void
}

const MAX_ZOOM_STEP = 10
const PINCH_ZOOM_THRESHOLD = 24
const PINCH_PAN_THRESHOLD = 16
const PINCH_PAN_TO_ZOOM_THRESHOLD = 64

export function normalizeWheel(event: WheelEvent): { x: number; y: number; z: number } {
  let { deltaX, deltaY } = event
  let deltaZ = 0
  if (event.ctrlKey || event.altKey || event.metaKey) {
    deltaZ = (Math.abs(deltaY) > MAX_ZOOM_STEP ? MAX_ZOOM_STEP * Math.sign(deltaY) : deltaY) / 100
  }
  return { x: -deltaX, y: -deltaY, z: -deltaZ }
}

export class CanvasEventBridge {
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private pinchState: 'not sure' | 'zooming' | 'panning' = 'not sure'
  private pinchDistance = 0
  private pinchInitialDistance = 1
  private pinchOrigin = { x: 0, y: 0 }
  private pinchPrevious = { x: 0, y: 0 }
  private pinchCamera: { x: number; y: number; z: number } | null = null

  constructor(private readonly editor: Editor) {}

  getHandlers(): CanvasEventHandlers {
    return {
      onPointerDown: event => this.pointerDown(event),
      onPointerMove: event => this.pointerMove(event),
      onPointerUp: event => this.pointerUp(event),
      onPointerCancel: event => this.pointerCancel(event),
      onDoubleClick: event => this.doubleClick(event),
      onContextMenu: event => this.contextMenu(event),
      onWheel: event => this.wheel(event),
      onKeyDown: event => this.keyDown(event),
      onKeyUp: event => this.keyUp(event),
      onTouchStart: event => this.touchStart(event),
      onTouchMove: event => this.touchMove(event),
      onTouchEnd: event => this.touchEnd(event),
      onTouchCancel: event => this.touchEnd(event)
    }
  }

  private pointerDown(event: PointerEvent): void {
    const screen = screenPoint(event, this.editor.getContainer())
    const page = this.editor.screenToPage(screen)
    this.pointers.set(event.pointerId, screen)
    capture(this.editor.getContainer(), event, true)
    this.dispatch(
      pointerInfo(
        event.button === 1 ? 'middle_click' : event.button === 2 ? 'right_click' : 'pointer_down',
        event,
        screen,
        page,
        'down'
      )
    )
  }

  private pointerMove(event: PointerEvent): void {
    const screen = screenPoint(event, this.editor.getContainer())
    const page = this.editor.screenToPage(screen)
    this.pointers.set(event.pointerId, screen)
    this.dispatch(pointerInfo('pointer_move', event, screen, page, 'move'))
  }

  private pointerUp(event: PointerEvent): void {
    const screen = screenPoint(event, this.editor.getContainer())
    const page = this.editor.screenToPage(screen)
    this.editor.inputs.pointerUp(screen, page, event)
    this.pointers.delete(event.pointerId)
    capture(this.editor.getContainer(), event, false)
    this.dispatch(pointerInfo('pointer_up', event, screen, page, 'up'))
  }

  private pointerCancel(event: PointerEvent): void {
    this.pointers.delete(event.pointerId)
    this.editor.inputs.cancelPointer()
    this.dispatch({ name: 'cancel', pointerId: event.pointerId, originalEvent: event })
  }

  private doubleClick(event: MouseEvent): void {
    this.dispatch(mouseInfo('double_click', event, this.editor, 'down'))
  }

  private contextMenu(event: MouseEvent): void {
    this.dispatch(mouseInfo('right_click', event, this.editor))
  }

  private wheel(event: WheelEvent): void {
    const screen = screenPoint(event, this.editor.getContainer())
    const page = this.editor.screenToPage(screen)
    this.pinchState = 'not sure'
    this.editor.inputs.updateModifiers(event)
    this.editor.inputs.update(screen, page)
    const delta = normalizeWheel(event)
    if (delta.x === 0 && delta.y === 0) return
    const { panSpeed, zoomSpeed } = this.editor.getCameraOptions()
    const camera = this.editor.getCamera()
    this.editor.stopCameraAnimation()
    if (event.ctrlKey || event.metaKey) {
      const zoom = camera.z + delta.z * zoomSpeed * camera.z
      this.editor.setCamera(
        {
          x: camera.x + screen.x / zoom - screen.x / camera.z,
          y: camera.y + screen.y / zoom - screen.y / camera.z,
          z: zoom
        },
        { immediate: true }
      )
    } else {
      this.editor.setCamera(
        {
          x: camera.x + (delta.x * panSpeed) / camera.z,
          y: camera.y + (delta.y * panSpeed) / camera.z,
          z: camera.z
        },
        { immediate: true }
      )
    }
    this.dispatch({
      name: 'wheel',
      point: this.editor.inputs.getCurrentPagePoint(),
      screenPoint: screen,
      delta,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.metaKey || event.ctrlKey,
      accelKey: event.metaKey || event.ctrlKey,
      originalEvent: event
    })
  }

  private keyDown(event: KeyboardEvent): void {
    this.editor.inputs.setKey(event.code, true)
    this.editor.inputs.updateModifiers(event)
    if (event.key === 'Escape') {
      if (this.editor.getEditingShape() || this.editor.getSelectedShapeIds().length) event.preventDefault()
      this.editor.cancel()
      this.editor.focus()
      return
    }
    if (handleShortcut(this.editor, event)) {
      event.preventDefault()
      return
    }
    this.dispatch(keyInfo(event.repeat ? 'key_repeat' : 'key_down', event))
  }

  private keyUp(event: KeyboardEvent): void {
    this.editor.inputs.setKey(event.code, false)
    this.editor.inputs.updateModifiers(event)
    this.dispatch(keyInfo('key_up', event))
  }

  private touchStart(event: TouchEvent): void {
    if (event.touches.length !== 2) return
    const center = touchCenter(event.touches, this.editor.getContainer())
    this.pinchState = 'not sure'
    this.pinchDistance = touchDistance(event.touches)
    this.pinchInitialDistance = Math.max(this.pinchDistance, 1)
    this.pinchOrigin = center
    this.pinchPrevious = center
    this.pinchCamera = this.editor.getCamera()
    this.editor.inputs.setIsPinching(true)
  }

  private touchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || !this.pinchCamera) return
    const center = touchCenter(event.touches, this.editor.getContainer())
    this.pinchDistance = touchDistance(event.touches)
    const offset = { x: center.x - this.pinchPrevious.x, y: center.y - this.pinchPrevious.y }
    this.pinchPrevious = center
    this.updatePinchState(center)
    if (this.pinchState === 'panning') {
      this.editor.pan(offset, { immediate: true })
    } else if (this.pinchState === 'zooming') {
      const z = (this.pinchCamera.z * this.pinchDistance) / this.pinchInitialDistance
      const camera = this.editor.getCamera()
      this.editor.setCamera(
        {
          x: camera.x + offset.x / camera.z + center.x / z - center.x / camera.z,
          y: camera.y + offset.y / camera.z + center.y / z - center.y / camera.z,
          z
        },
        { immediate: true }
      )
    }
    this.dispatch({
      name: 'pointer_move',
      point: this.editor.screenToPage(center),
      screenPoint: center,
      phase: 'move',
      isPinching: true,
      originalEvent: event
    })
  }

  private touchEnd(event: TouchEvent): void {
    if (event.touches.length >= 2) return
    this.pinchState = 'not sure'
    this.pinchDistance = 0
    this.pinchCamera = null
    this.editor.inputs.setIsPinching(false)
  }

  private updatePinchState(center: { x: number; y: number }): void {
    if (this.pinchState === 'zooming') return
    const fingers = Math.abs(this.pinchDistance - this.pinchInitialDistance)
    if (this.pinchState === 'panning') {
      if (fingers > PINCH_PAN_TO_ZOOM_THRESHOLD) this.pinchState = 'zooming'
      return
    }
    const travelled = Math.hypot(center.x - this.pinchOrigin.x, center.y - this.pinchOrigin.y)
    if (fingers > PINCH_ZOOM_THRESHOLD) this.pinchState = 'zooming'
    else if (travelled > PINCH_PAN_THRESHOLD) this.pinchState = 'panning'
  }

  private dispatch(info: CanvasEventInfo): void {
    this.editor.dispatch(info)
  }
}

function capture(container: HTMLElement | null, event: PointerEvent, hold: boolean): void {
  const element = container as (HTMLElement & Partial<Element>) | null
  try {
    if (hold) element?.setPointerCapture?.(event.pointerId)
    else if (element?.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture?.(event.pointerId)
  } catch {
    return
  }
}

function pointerInfo(
  name: CanvasEventInfo['name'],
  event: PointerEvent,
  screen: { x: number; y: number },
  page: { x: number; y: number },
  phase: string
): CanvasEventInfo {
  return {
    name,
    target: 'canvas',
    point: page,
    screenPoint: screen,
    phase,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPen: event.pointerType === 'pen',
    button: event.button,
    buttons: event.buttons,
    pressure: event.pressure,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.metaKey || event.ctrlKey,
    metaKey: event.metaKey,
    accelKey: event.metaKey || event.ctrlKey,
    originalEvent: event
  }
}

function mouseInfo(name: CanvasEventInfo['name'], event: MouseEvent, editor: Editor, phase = 'up'): CanvasEventInfo {
  const screen = screenPoint(event, editor.getContainer())
  return pointerInfo(name, event as PointerEvent, screen, editor.screenToPage(screen), phase)
}

function keyInfo(name: CanvasEventInfo['name'], event: KeyboardEvent): CanvasEventInfo {
  return {
    name,
    key: event.key,
    code: event.code,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.metaKey || event.ctrlKey,
    metaKey: event.metaKey,
    accelKey: event.metaKey || event.ctrlKey,
    originalEvent: event
  }
}

function screenPoint(event: MouseEvent, container: HTMLElement): { x: number; y: number } {
  const rect = container.getBoundingClientRect?.() ?? { left: 0, top: 0 }
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function touchDistance(touches: TouchList): number {
  return Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY)
}

function touchCenter(touches: TouchList, container: HTMLElement): { x: number; y: number } {
  const rect = container.getBoundingClientRect?.() ?? { left: 0, top: 0 }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
  }
}
