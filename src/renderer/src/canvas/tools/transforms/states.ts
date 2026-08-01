import { EVENT_NAME_MAP, StateNode, type CanvasEventInfo, type StateNodeConstructor } from '../state'
import { DragAndDropManager } from './dragAndDrop'
import { DraggingHandle } from './handleDragging'
import { Resizing } from './resize'
import { Rotating } from './rotation'
import { Translating } from './translation'
import type { TransformState } from './types'

type AnyTransform = new (editor: any, parent: any) => TransformState<any, any> & Record<string, unknown>

export function transformStateNode(Transform: AnyTransform, id: string): StateNodeConstructor<any> {
  class TransformNode extends StateNode<any> {
    static id = id
    static trackPerformance = true
    readonly transform = new Transform(this.editor, this.parent)

    override onEnter(info: unknown, from: string): void {
      this.transform.enter(info, from)
    }

    override onExit(info: unknown, to: string): void {
      this.transform.exit(info, to)
    }

    override handleEvent(info: CanvasEventInfo): void {
      const handler = this.transform[EVENT_NAME_MAP[info.name]]
      if (typeof handler === 'function') handler.call(this.transform, info)
    }
  }
  return TransformNode
}

export function translatingStateNode(): StateNodeConstructor<any> {
  class TranslatingNode extends StateNode<any> {
    static id = 'translating'
    static trackPerformance = true
    readonly transform = new Translating(this.editor, this.parent)

    override onEnter(info: unknown, from: string): void {
      this.transform.dragTargets ??= new DragAndDropManager(this.editor)
      this.transform.enter(info as never, from)
    }

    override onExit(info: unknown, to: string): void {
      this.transform.exit(info, to)
    }

    override handleEvent(info: CanvasEventInfo): void {
      const handler = (this.transform as unknown as Record<string, unknown>)[EVENT_NAME_MAP[info.name]]
      if (typeof handler === 'function') handler.call(this.transform, info)
    }
  }
  return TranslatingNode
}

export function transformStates(): StateNodeConstructor<any>[] {
  return [
    translatingStateNode(),
    transformStateNode(Resizing as unknown as AnyTransform, 'resizing'),
    transformStateNode(Rotating as unknown as AnyTransform, 'rotating'),
    transformStateNode(DraggingHandle as unknown as AnyTransform, 'dragging_handle')
  ]
}
