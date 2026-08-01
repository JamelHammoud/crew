import { clamp } from '../../math/utils'
import { Vec, type VecModel } from '../../math/Vec'

export interface HandPointerEvent {
  phase?: 'settle-down' | 'settle-up'
}

export interface HandEditor {
  inputs: {
    getCurrentScreenPoint(): VecModel
    getOriginScreenPoint(): VecModel
    getPointerVelocity(): VecModel
    getIsDragging(): boolean
  }
  menus: { clearOpenMenus(): void }
  getCamera(): VecModel
  getZoomLevel(): number
  getInstanceState(): { isCoarsePointer: boolean }
  getCameraOptions(): { zoomSteps: number[] }
  getBaseZoom(): number
  setCamera(camera: VecModel, options?: { immediate: boolean }): void
  setCursor(cursor: { type: 'grab' | 'grabbing'; rotation: number }): void
  setCurrentTool(id: string): void
  stopCameraAnimation(): void
  slideCamera(options: { speed: number; direction: VecModel }): void
  zoomIn(point: VecModel, options: { animation: { duration: number; easing: (t: number) => number } }): void
}

export type HandStateId = 'idle' | 'pointing' | 'dragging' | 'one_finger_zooming'

abstract class HandState {
  constructor(
    protected readonly tool: HandTool,
    protected readonly editor: HandEditor
  ) {}

  onEnter(_info?: HandPointerEvent): void {}
  onExit(_info?: HandPointerEvent, _to?: HandStateId): void {}
  onPointerDown(_info?: HandPointerEvent): void {}
  onPointerMove(_info?: HandPointerEvent): void {}
  onPointerUp(_info?: HandPointerEvent): void {}
  onLongPress(_info?: HandPointerEvent): void {}
  onCancel(): void {}
  onComplete(): void {}
  onInterrupt(): void {}
}

export class HandIdle extends HandState {
  static readonly id = 'idle'

  override onEnter(): void {
    this.editor.setCursor({ type: 'grab', rotation: 0 })
  }

  override onPointerDown(info?: HandPointerEvent): void {
    this.tool.transition('pointing', info)
  }

  override onCancel(): void {
    this.editor.setCurrentTool('select')
  }
}

export class HandPointing extends HandState {
  static readonly id = 'pointing'

  override onEnter(): void {
    this.editor.stopCameraAnimation()
    this.editor.setCursor({ type: 'grabbing', rotation: 0 })
  }

  override onLongPress(): void {
    this.tool.transition('dragging')
  }

  override onPointerMove(): void {
    if (this.editor.inputs.getIsDragging()) this.tool.transition('dragging')
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onCancel(): void {
    this.complete()
  }

  override onComplete(): void {
    this.complete()
  }

  override onInterrupt(): void {
    this.complete()
  }

  private complete(): void {
    this.tool.transition('idle')
  }
}

export class HandDragging extends HandState {
  static readonly id = 'dragging'
  static readonly trackPerformance = true
  initialCamera = new Vec()

  override onEnter(): void {
    this.initialCamera = Vec.From(this.editor.getCamera())
    this.update()
  }

  override onPointerMove(): void {
    this.update()
  }

  override onPointerDown(): void {
    this.tool.transition('idle')
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onInterrupt(): void {
    this.tool.transition('idle')
  }

  override onCancel(): void {
    this.tool.transition('idle')
  }

  override onComplete(): void {
    this.complete()
  }

  private update(): void {
    const current = this.editor.inputs.getCurrentScreenPoint()
    const origin = this.editor.inputs.getOriginScreenPoint()
    const delta = Vec.Sub(current, origin).div(this.editor.getZoomLevel())
    if (delta.len2() === 0) return
    this.editor.setCamera(this.initialCamera.clone().add(delta))
  }

  private complete(): void {
    const velocity = Vec.From(this.editor.inputs.getPointerVelocity())
    const speed = Math.min(velocity.len(), 2)
    if (speed > 0.1) {
      this.editor.slideCamera({ speed, direction: { x: velocity.x, y: velocity.y, z: 0 } })
    }
    this.tool.transition('idle')
  }
}

export class HandOneFingerZooming extends HandState {
  static readonly id = 'one_finger_zooming'
  private anchorScreenPoint = new Vec()
  private initialCamera = new Vec()
  private initialZoom = 1
  private originScreenY = 0

  override onEnter(): void {
    const camera = this.editor.getCamera()
    this.initialCamera = Vec.From(camera)
    this.initialZoom = camera.z ?? 1
    this.anchorScreenPoint = Vec.From(this.editor.inputs.getOriginScreenPoint())
    this.originScreenY = this.editor.inputs.getCurrentScreenPoint().y
    this.editor.setCursor({ type: 'grab', rotation: 0 })
  }

  override onPointerMove(): void {
    this.editor.menus.clearOpenMenus()
    const currentScreenY = this.editor.inputs.getCurrentScreenPoint().y
    const dy = (this.originScreenY - currentScreenY) * -1
    const newZoom = this.clampZoom(this.initialZoom * Math.pow(2, dy / 200))
    const { x: cx, y: cy } = this.initialCamera
    const { x: sx, y: sy } = this.anchorScreenPoint
    this.editor.setCamera(
      new Vec(cx + sx / newZoom - sx / this.initialZoom, cy + sy / newZoom - sy / this.initialZoom, newZoom),
      { immediate: true }
    )
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onCancel(): void {
    this.tool.transition('idle')
  }

  override onInterrupt(): void {
    this.tool.transition('idle')
  }

  private complete(): void {
    const velocity = Vec.From(this.editor.inputs.getPointerVelocity())
    const speed = Math.min(velocity.len(), 2)
    if (speed > 0.1) {
      this.editor.slideCamera({ speed, direction: { x: 0, y: 0, z: Math.sign(velocity.y) * 0.01 } })
    }
    this.tool.transition('idle')
  }

  private clampZoom(zoom: number): number {
    const steps = this.editor.getCameraOptions().zoomSteps
    const base = this.editor.getBaseZoom()
    return clamp(zoom, steps[0] * base, steps[steps.length - 1] * base)
  }
}

export class HandTool {
  static readonly id = 'hand'
  static readonly initial = 'idle'
  static readonly isLockable = false
  readonly children: Record<HandStateId, HandState>
  stateId: HandStateId = 'idle'

  constructor(readonly editor: HandEditor) {
    this.children = {
      idle: new HandIdle(this, editor),
      pointing: new HandPointing(this, editor),
      dragging: new HandDragging(this, editor),
      one_finger_zooming: new HandOneFingerZooming(this, editor)
    }
    this.children.idle.onEnter()
  }

  get state(): HandState {
    return this.children[this.stateId]
  }

  transition(id: HandStateId, info?: HandPointerEvent): void {
    if (id === this.stateId) return
    const previous = this.state
    previous.onExit(info, id)
    this.stateId = id
    this.state.onEnter(info)
  }

  enter(info?: HandPointerEvent): void {
    this.stateId = HandTool.initial
    this.state.onEnter(info)
  }

  exit(info?: HandPointerEvent, to?: HandStateId): void {
    this.state.onExit(info, to)
  }

  onPointerDown(info?: HandPointerEvent): void {
    this.state.onPointerDown(info)
  }

  onPointerMove(info?: HandPointerEvent): void {
    this.state.onPointerMove(info)
  }

  onPointerUp(info?: HandPointerEvent): void {
    this.state.onPointerUp(info)
  }

  onLongPress(info?: HandPointerEvent): void {
    this.state.onLongPress(info)
  }

  onCancel(): void {
    this.state.onCancel()
  }

  onComplete(): void {
    this.state.onComplete()
  }

  onInterrupt(): void {
    this.state.onInterrupt()
  }

  onDoubleClick(info: HandPointerEvent): void {
    if (info.phase === 'settle-down' && this.editor.getInstanceState().isCoarsePointer) {
      this.transition('one_finger_zooming', info)
    }
    if (info.phase === 'settle-up') {
      const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)
      this.editor.zoomIn(this.editor.inputs.getCurrentScreenPoint(), {
        animation: { duration: 220, easing: easeOutQuint }
      })
    }
  }
}
