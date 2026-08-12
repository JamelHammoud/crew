import { atom, type Atom } from '../signals'
import { Vec } from '../math'
import type { VecLike } from './types'

const VELOCITY_INTERVAL_MS = 16
const VELOCITY_SMOOTHING = 0.5

export interface InputModifiers {
  shiftKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

export interface InputEventInfo extends InputModifiers {
  name?: string
  phase?: string
  point?: VecLike
  screenPoint?: VecLike
  isPen?: boolean
  button?: number
}

export interface InputView {
  camera: { x: number; y: number; z: number }
  screenBounds: { x: number; y: number }
  dragDistanceSquared?: number
}

const DOWN_NAMES = new Set(['pointer_down', 'middle_click', 'right_click', 'double_click'])
const POINTER_NAMES = new Set([...DOWN_NAMES, 'pointer_move', 'pointer_up'])

export class InputsManager {
  readonly keys = new Set<string>()
  readonly buttons = new Set<number>()

  private readonly screenPoint: Atom<Vec>
  private readonly pagePoint: Atom<Vec>
  private readonly previousScreen: Atom<Vec>
  private readonly previousPage: Atom<Vec>
  private readonly velocity: Atom<Vec>
  private readonly pointing: Atom<boolean>
  private originScreenPoint = new Vec()
  private originPagePoint = new Vec()
  private velocityPrevious = new Vec()
  private rightPointing = false
  private dragging = false
  private panning = false
  private spacebarPanning = false
  private pinching = false
  private editing = false
  private pen = false
  private shiftKey = false
  private altKey = false
  private ctrlKey = false
  private metaKey = false

  constructor() {
    this.screenPoint = atom('editor.inputs.screenPoint', new Vec())
    this.pagePoint = atom('editor.inputs.pagePoint', new Vec())
    this.previousScreen = atom('editor.inputs.previousScreenPoint', new Vec())
    this.previousPage = atom('editor.inputs.previousPagePoint', new Vec())
    this.velocity = atom('editor.inputs.pointerVelocity', new Vec())
    this.pointing = atom('editor.inputs.isPointing', false)
  }

  get currentScreenPoint(): Vec {
    return this.screenPoint.get()
  }

  get currentPagePoint(): Vec {
    return this.pagePoint.get()
  }

  getCurrentScreenPoint(): Vec {
    return this.screenPoint.get()
  }

  getCurrentPagePoint(): Vec {
    return this.pagePoint.get()
  }

  getPreviousScreenPoint(): Vec {
    return this.previousScreen.get()
  }

  getPreviousPagePoint(): Vec {
    return this.previousPage.get()
  }

  getOriginScreenPoint(): Vec {
    return this.originScreenPoint
  }

  getOriginPagePoint(): Vec {
    return this.originPagePoint
  }

  getPointerVelocity(): Vec {
    return this.velocity.get()
  }

  setPointerVelocity(value: Vec): void {
    this.velocity.set(value)
  }

  getIsPointing(): boolean {
    return this.pointing.get()
  }

  getIsRightPointing(): boolean {
    return this.rightPointing
  }

  getIsDragging(): boolean {
    return this.dragging
  }

  setIsDragging(value: boolean): void {
    this.dragging = value
  }

  getIsPanning(): boolean {
    return this.panning
  }

  setIsPanning(value: boolean): void {
    this.panning = value
  }

  getIsSpacebarPanning(): boolean {
    return this.spacebarPanning
  }

  setIsSpacebarPanning(value: boolean): void {
    this.spacebarPanning = value
  }

  getIsPinching(): boolean {
    return this.pinching
  }

  setIsPinching(value: boolean): void {
    this.pinching = value
  }

  getIsEditing(): boolean {
    return this.editing
  }

  setIsEditing(value: boolean): void {
    this.editing = value
  }

  getIsPen(): boolean {
    return this.pen
  }

  setIsPen(value: boolean): void {
    this.pen = value
  }

  getShiftKey(): boolean {
    return this.shiftKey
  }

  getAltKey(): boolean {
    return this.altKey
  }

  getCtrlKey(): boolean {
    return this.ctrlKey
  }

  getMetaKey(): boolean {
    return this.metaKey
  }

  getAccelKey(): boolean {
    return this.metaKey || this.ctrlKey
  }

  updateFromEvent(info: InputEventInfo, view: InputView): void {
    const name = info.name ?? ''
    if (!POINTER_NAMES.has(name)) return
    const source = info.screenPoint ?? info.point
    if (!source) return
    this.updateModifiers(info)

    const { x: cx, y: cy, z: cz } = view.camera
    const screen = new Vec(source.x - view.screenBounds.x, source.y - view.screenBounds.y)
    const nx = screen.x / cz - cx
    const ny = screen.y / cz - cy
    const page = isFinite(nx) && isFinite(ny) ? new Vec(nx, ny, info.point?.z ?? 0.5) : Vec.From(this.pagePoint.get())
    this.update(screen, page)
    if (typeof info.isPen === 'boolean') this.pen = info.isPen

    if (info.phase ? info.phase === 'down' : DOWN_NAMES.has(name)) {
      this.originScreenPoint = screen.clone()
      this.originPagePoint = page.clone()
      this.velocity.set(new Vec())
      this.velocityPrevious = screen.clone()
      this.pointing.set(true)
      this.dragging = false
      if (typeof info.button === 'number') this.setButton(info.button, true)
      return
    }

    if (name === 'pointer_move') {
      const threshold = view.dragDistanceSquared ?? 16
      if (this.pointing.get() && Vec.Dist2(this.originScreenPoint, screen) >= threshold) this.dragging = true
      return
    }

    if (name === 'pointer_up') {
      this.pointing.set(false)
      this.rightPointing = false
      this.dragging = false
      this.pen = false
      this.buttons.clear()
    }
  }

  pointerDown(screenPoint: VecLike, pagePoint: VecLike, modifiers: InputModifiers, pointerType?: string): void {
    this.updateModifiers(modifiers)
    this.update(screenPoint, pagePoint)
    this.originScreenPoint = Vec.From(screenPoint)
    this.originPagePoint = Vec.From(pagePoint)
    this.velocity.set(new Vec())
    this.velocityPrevious = Vec.From(screenPoint)
    this.pointing.set(true)
    this.dragging = false
    this.pen = pointerType === 'pen'
  }

  pointerMove(screenPoint: VecLike, pagePoint: VecLike, modifiers: InputModifiers, dragDistanceSquared = 16): void {
    this.updateModifiers(modifiers)
    this.update(screenPoint, pagePoint)
    if (this.pointing.get() && Vec.Dist2(this.originScreenPoint, screenPoint) > dragDistanceSquared)
      this.dragging = true
  }

  pointerUp(screenPoint: VecLike, pagePoint: VecLike, modifiers: InputModifiers): void {
    this.updateModifiers(modifiers)
    this.update(screenPoint, pagePoint)
    this.pointing.set(false)
    this.rightPointing = false
    this.dragging = false
    this.pen = false
    this.buttons.clear()
  }

  cancelPointer(): void {
    this.pointing.set(false)
    this.rightPointing = false
    this.dragging = false
    this.pen = false
    this.buttons.clear()
  }

  setButton(button: number, down: boolean): void {
    if (down) this.buttons.add(button)
    else this.buttons.delete(button)
    if (button === 2) this.rightPointing = down
  }

  updateModifiers(modifiers: InputModifiers): void {
    this.shiftKey = modifiers.shiftKey ?? this.shiftKey
    this.altKey = modifiers.altKey ?? this.altKey
    this.ctrlKey = modifiers.ctrlKey ?? this.ctrlKey
    this.metaKey = modifiers.metaKey ?? this.metaKey
  }

  setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code)
    else this.keys.delete(code)
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.shiftKey = down
    if (code === 'AltLeft' || code === 'AltRight') this.altKey = down
    if (code === 'ControlLeft' || code === 'ControlRight') this.ctrlKey = down
    if (code === 'MetaLeft' || code === 'MetaRight') this.metaKey = down
  }

  clearKeys(): void {
    this.keys.clear()
  }

  update(screenPoint: VecLike, pagePoint: VecLike): void {
    this.previousScreen.set(this.screenPoint.get())
    this.previousPage.set(this.pagePoint.get())
    this.screenPoint.set(Vec.From(screenPoint))
    this.pagePoint.set(Vec.From(pagePoint))
  }

  updatePointerVelocity(elapsed: number): void {
    if (elapsed === 0) return
    const current = this.screenPoint.get()
    const previous = this.velocity.get()
    const delta = Vec.Sub(current, this.velocityPrevious)
    this.velocityPrevious = current.clone()
    const length = delta.len()
    const direction = length ? delta.div(length) : new Vec(0, 0)
    const smoothing = 1 - (1 - VELOCITY_SMOOTHING) ** (elapsed / VELOCITY_INTERVAL_MS)
    const next = previous.clone().lrp(direction.mul(length / elapsed), smoothing)
    if (Math.abs(next.x) < 0.01) next.x = 0
    if (Math.abs(next.y) < 0.01) next.y = 0
    if (!previous.equals(next)) this.velocity.set(next)
  }
}
