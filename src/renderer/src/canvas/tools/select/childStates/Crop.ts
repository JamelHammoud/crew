import { StateNode, type StateNodeConstructor } from '../../state'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class CroppingIdle extends StateNode<SelectEditor> {
  static id = 'idle'

  onEnter(): void {
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }

  onPointerDown(info: SelectPointerInfo): void {
    if (info.target === 'selection') {
      this.parent.transition('pointing_crop', info)
      return
    }
    this.exitCropping(info)
  }

  onDoubleClick(): void {
    const shape = this.editor.getOnlySelectedShape()
    if (shape && this.editor.canEditShape(shape)) {
      this.editor.markHistoryStoppingPoint('editing shape')
      this.editor.setEditingShape(shape)
      this.parent.parent.transition('editing_shape', { target: 'shape', shape })
    }
  }

  onCancel(): void {
    this.exitCropping()
  }

  onComplete(): void {
    this.exitCropping()
  }

  onInterrupt(): void {
    this.exitCropping()
  }

  private exitCropping(info?: SelectPointerInfo): void {
    this.editor.setCroppingShape?.(null)
    this.parent.parent.transition('idle', info)
  }
}

export class PointingCrop extends StateNode<SelectEditor> {
  static id = 'pointing_crop'
  private info: SelectPointerInfo = { target: 'selection' }

  onEnter(info: SelectPointerInfo): void {
    this.info = info
  }

  onPointerMove(): void {
    if (this.editor.inputs.getIsDragging()) this.parent.transition('translating_crop', this.info)
  }

  onPointerUp(): void {
    this.parent.transition('idle', this.info)
  }

  onCancel(): void {
    this.parent.transition('idle', this.info)
  }

  onComplete(): void {
    this.parent.transition('idle', this.info)
  }

  onInterrupt(): void {
    this.parent.transition('idle', this.info)
  }
}

export class PointingCropHandle extends StateNode<SelectEditor> {
  static id = 'pointing_crop_handle'
  private info: SelectPointerInfo = { target: 'selection' }

  onEnter(info: SelectPointerInfo): void {
    this.info = info
    if (typeof info.onInteractionEnd === 'string') this.parent.setCurrentToolIdMask(info.onInteractionEnd)
  }

  onExit(): void {
    this.parent.setCurrentToolIdMask(undefined)
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }

  onPointerMove(): void {
    if (this.editor.inputs.getIsDragging()) this.parent.transition('cropping', this.info)
  }

  onPointerUp(): void {
    this.finish()
  }

  onCancel(): void {
    this.finish()
  }

  onComplete(): void {
    this.finish()
  }

  onInterrupt(): void {
    this.finish()
  }

  private finish(): void {
    const end = this.info.onInteractionEnd
    if (typeof end === 'string') this.editor.setCurrentTool(end, {})
    else if (typeof end === 'function') end()
    else this.parent.transition('idle', this.info)
  }
}

export class TranslatingCrop extends StateNode<SelectEditor> {
  static id = 'translating_crop'
  private markId = ''

  onEnter(): void {
    this.markId = this.editor.markHistoryStoppingPoint('translating crop')
    this.editor.setCursor({ type: 'move', rotation: 0 })
  }

  onExit(): void {
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }

  onPointerUp(): void {
    this.parent.transition('idle')
  }

  onComplete(): void {
    this.parent.transition('idle')
  }

  onCancel(): void {
    if (this.markId) this.editor.bailToMark(this.markId)
    this.parent.transition('idle')
  }
}

export class Cropping extends StateNode<SelectEditor> {
  static id = 'cropping'
  private markId = ''
  private info: SelectPointerInfo = { target: 'selection' }

  onEnter(info: SelectPointerInfo): void {
    this.info = info
    this.markId = this.editor.markHistoryStoppingPoint('cropping')
  }

  onPointerUp(): void {
    this.parent.transition('idle', this.info)
  }

  onComplete(): void {
    this.parent.transition('idle', this.info)
  }

  onCancel(): void {
    if (this.markId) this.editor.bailToMark(this.markId)
    this.parent.transition('idle', this.info)
  }
}

export class Crop extends StateNode<SelectEditor> {
  static id = 'crop'
  static initial = 'idle'

  static children(): StateNodeConstructor<SelectEditor>[] {
    return [
      CroppingIdle,
      PointingCrop,
      PointingCropHandle,
      TranslatingCrop,
      Cropping
    ] as StateNodeConstructor<SelectEditor>[]
  }

  onEnter(): void {
    const shape = this.editor.getOnlySelectedShape()
    if (shape) this.editor.setCroppingShape?.(shape.id)
  }

  onExit(): void {
    this.editor.setCroppingShape?.(null)
  }
}
