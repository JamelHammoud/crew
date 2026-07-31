import { atom, type Atom } from '../signals'
import { Vec } from '../math'
import type { VecLike } from './types'

export interface InputModifiers {
  shiftKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

export class InputsManager {
  private readonly screenPoint: Atom<Vec>
  private readonly pagePoint: Atom<Vec>
  private originScreenPoint = new Vec()
  private originPagePoint = new Vec()
  private pointerVelocity = new Vec()
  private previousScreenPoint = new Vec()
  private previousTimestamp = 0
  private pointing = false
  private dragging = false
  private panning = false
  private pen = false
  private shiftKey = false
  private altKey = false
  private ctrlKey = false
  private metaKey = false

  constructor() {
    this.screenPoint = atom('editor.inputs.screenPoint', new Vec())
    this.pagePoint = atom('editor.inputs.pagePoint', new Vec())
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

  getOriginScreenPoint(): Vec {
    return this.originScreenPoint
  }

  getOriginPagePoint(): Vec {
    return this.originPagePoint
  }

  getPointerVelocity(): Vec {
    return this.pointerVelocity
  }

  getIsPointing(): boolean {
    return this.pointing
  }

  getIsDragging(): boolean {
    return this.dragging
  }

  getIsPanning(): boolean {
    return this.panning
  }

  getIsPen(): boolean {
    return this.pen
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

  getAccelKey(): boolean {
    return this.metaKey || this.ctrlKey
  }

  pointerDown(screenPoint: VecLike, pagePoint: VecLike, modifiers: InputModifiers, pointerType?: string): void {
    this.updateModifiers(modifiers)
    this.update(screenPoint, pagePoint)
    this.originScreenPoint = Vec.From(screenPoint)
    this.originPagePoint = Vec.From(pagePoint)
    this.previousScreenPoint = Vec.From(screenPoint)
    this.previousTimestamp = now()
    this.pointerVelocity = new Vec()
    this.pointing = true
    this.dragging = false
    this.pen = pointerType === 'pen'
  }

  pointerMove(screenPoint: VecLike, pagePoint: VecLike, modifiers: InputModifiers, dragDistanceSquared = 16): void {
    this.updateModifiers(modifiers)
    const timestamp = now()
    const elapsed = Math.max(1, timestamp - this.previousTimestamp)
    this.pointerVelocity = Vec.Sub(screenPoint, this.previousScreenPoint).div(elapsed)
    this.previousScreenPoint = Vec.From(screenPoint)
    this.previousTimestamp = timestamp
    this.update(screenPoint, pagePoint)
    if (this.pointing && Vec.Dist2(this.originScreenPoint, screenPoint) >= dragDistanceSquared) this.dragging = true
  }

  pointerUp(screenPoint: VecLike, pagePoint: VecLike, modifiers: InputModifiers): void {
    this.updateModifiers(modifiers)
    this.update(screenPoint, pagePoint)
    this.pointing = false
    this.dragging = false
    this.pen = false
  }

  cancelPointer(): void {
    this.pointing = false
    this.dragging = false
    this.pen = false
  }

  updateModifiers(modifiers: InputModifiers): void {
    this.shiftKey = modifiers.shiftKey ?? this.shiftKey
    this.altKey = modifiers.altKey ?? this.altKey
    this.ctrlKey = modifiers.ctrlKey ?? this.ctrlKey
    this.metaKey = modifiers.metaKey ?? this.metaKey
  }

  setKey(code: string, down: boolean): void {
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.shiftKey = down
    if (code === 'AltLeft' || code === 'AltRight') this.altKey = down
    if (code === 'ControlLeft' || code === 'ControlRight') this.ctrlKey = down
    if (code === 'MetaLeft' || code === 'MetaRight') this.metaKey = down
  }

  setIsPanning(value: boolean): void {
    this.panning = value
  }

  update(screenPoint: VecLike, pagePoint: VecLike): void {
    this.screenPoint.set(Vec.From(screenPoint))
    this.pagePoint.set(Vec.From(pagePoint))
  }
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}
