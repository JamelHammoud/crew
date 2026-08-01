import { BindingRecordType, createBindingId, type TLBinding, type TLBindingId, type TLShape, type TLShapeId } from '../schema'
import { arrowBindingBehavior } from './arrowBindings'
import type { BindingBehavior, BindingEditor, BindingPartial } from './bindingTypes'

interface BindingUtilInstance {
  onAfterCreate?(binding: TLBinding): void
  onAfterChange?(before: TLBinding, after: TLBinding): void
  onBeforeDelete?(binding: TLBinding): void
  getDefaultProps?(): Partial<TLBinding['props']>
}

export class BindingManager {
  private readonly utils = new Map<TLBinding['type'], BindingUtilInstance>()
  private readonly behaviors = new Map<TLBinding['type'], BindingBehavior>([['arrow', arrowBindingBehavior]])

  constructor(
    private readonly editor: BindingEditor,
    utils: readonly unknown[] = []
  ) {
    for (const Constructor of utils) {
      if (typeof Constructor !== 'function') continue
      const type = (Constructor as { type?: TLBinding['type'] }).type
      if (!type) continue
      this.utils.set(type, new (Constructor as new (editor: BindingEditor) => BindingUtilInstance)(editor))
    }
  }

  getBindingUtil(type: TLBinding['type']): BindingUtilInstance | undefined {
    return this.utils.get(type)
  }

  create(partials: BindingPartial[]): TLBinding[] {
    const records = partials.map(partial =>
      BindingRecordType.create({
        id: partial.id ?? createBindingId(),
        type: partial.type,
        fromId: partial.fromId,
        toId: partial.toId,
        props: {
          ...this.utils.get(partial.type)?.getDefaultProps?.(),
          ...partial.props
        } as TLBinding['props'],
        meta: partial.meta
      })
    )
    if (records.length) this.editor.store.put(records)
    return records
  }

  delete(ids: readonly TLBindingId[], options: { isolateShapes?: boolean } = {}): void {
    const bindings = ids.map(id => this.get(id)).filter((binding): binding is TLBinding => binding !== undefined)
    if (bindings.length === 0) return
    this.editor.run(() => {
      for (const binding of bindings) {
        if (options.isolateShapes) this.isolate(binding, this.editor.getShape(binding.toId))
        this.utils.get(binding.type)?.onBeforeDelete?.(binding)
      }
      this.editor.store.remove(bindings.map(binding => binding.id))
    })
  }

  get(id: TLBindingId): TLBinding | undefined {
    const record = this.editor.store.get(id)
    return record?.typeName === 'binding' ? record : undefined
  }

  fromShape(id: TLShapeId, type?: TLBinding['type']): TLBinding[] {
    return this.all().filter(binding => binding.fromId === id && (!type || binding.type === type))
  }

  toShape(id: TLShapeId, type?: TLBinding['type']): TLBinding[] {
    return this.all().filter(binding => binding.toId === id && (!type || binding.type === type))
  }

  involvingShape(id: TLShapeId, type?: TLBinding['type']): TLBinding[] {
    return this.all().filter(
      binding => (binding.fromId === id || binding.toId === id) && (!type || binding.type === type)
    )
  }

  handleBindingCreated(binding: TLBinding): void {
    this.utils.get(binding.type)?.onAfterCreate?.(binding)
  }

  handleBindingChanged(before: TLBinding, after: TLBinding): void {
    this.utils.get(after.type)?.onAfterChange?.(before, after)
  }

  handleShapeChanged(before: TLShape, after: TLShape): void {
    for (const binding of this.involvingShape(after.id)) {
      const behavior = this.behaviors.get(binding.type)
      if (!behavior) continue
      if (binding.fromId === after.id) behavior.onAfterChangeFromShape?.(this.editor, binding, before, after)
      if (binding.toId === after.id) behavior.onAfterChangeToShape?.(this.editor, binding, before, after)
    }
  }

  handleShapeDeleted(shape: TLShape): void {
    const bindings = this.involvingShape(shape.id)
    if (bindings.length === 0) return
    for (const binding of bindings) {
      const behavior = this.behaviors.get(binding.type)
      if (binding.fromId === shape.id) behavior?.onBeforeIsolateToShape?.(this.editor, binding, shape)
      else behavior?.onBeforeIsolateFromShape?.(this.editor, binding, shape)
      this.utils.get(binding.type)?.onBeforeDelete?.(binding)
    }
    this.editor.store.remove(bindings.map(binding => binding.id))
  }

  private isolate(binding: TLBinding, removed: TLShape | undefined): void {
    if (!removed) return
    this.behaviors.get(binding.type)?.onBeforeIsolateFromShape?.(this.editor, binding, removed)
  }

  private all(): TLBinding[] {
    return this.editor.store.query('binding').get()
  }
}
