import { BindingRecordType, createBindingId, type TLBinding, type TLBindingId, type TLShape, type TLShapeId } from '../schema'
import { arrowBindingBehavior } from './arrowBindings'
import type { BindingEditor, BindingBehavior, BindingPartial } from './bindingTypes'

interface BindingUtilInstance {
  onAfterCreate?(binding: TLBinding): void
  onAfterChange?(before: TLBinding, after: TLBinding): void
  onBeforeDelete?(binding: TLBinding): void
  getDefaultProps?(): Partial<TLBinding['props']>
}

export class BindingManager {
  private readonly utils = new Map<TLBinding['type'], BindingUtilInstance>()
  private readonly behaviors = new Map<TLBinding['type'], BindingBehavior>()

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
    this.behaviors.set('arrow', arrowBindingBehavior)
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
        props: { ...this.utils.get(partial.type)?.getDefaultProps?.(), ...partial.props },
        meta: partial.meta
      })
    )
    if (records.length) this.editor.store.put(records)
    return records
  }

  delete(ids: readonly TLBindingId[], options: { isolateShapes?: boolean } = {}): void {
    const bindings = ids
      .map(id => this.editor.store.get(id))
      .filter((binding): binding is TLBinding => binding?.typeName === 'binding')
    if (bindings.length === 0) return
    this.editor.run(() => {
      for (const binding of bindings) {
        if (options.isolateShapes) {
          const from = this.editor.getShape(binding.fromId)
          const to = this.editor.getShape(binding.toId)
          if (from && to) {
            this.behaviors.get(binding.type)?.onBeforeIsolateFromShape?.(this.editor, binding, to)
            this.behaviors.get(binding.type)?.onBeforeIsolateToShape?.(this.editor, binding, from)
          }
        }
        this.utils.get(binding.type)?.onBeforeDelete?.(binding)
      }
      this.editor.store.remove(bindings.map(binding => binding.id))
    })
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
    this.utils.get(before.type)?.onAfterChange?.(before, after)
  }

  handleShapeChanged(before: TLShape, after: TLShape): void {
    for (const binding of this.involvingShape(after.id)) {
      const behavior = this.behaviors.get(binding.type)
      if (!behavior) continue
      if (binding.fromId === after.id) behavior.onAfterChangeFromShape?.(this.editor, binding, before, after)
      if (binding.toId === after.id) behavior.onAfterChangeToShape?.(this.editor, binding, before, after)
    }
  }

  handleShapeDeleted(shape: TLShape, alsoDeleted: ReadonlySet<TLShapeId>): void {
    const bindings = this.involvingShape(shape.id)
    if (bindings.length === 0) return
    const isolating = bindings.filter(binding => {
      const other = binding.fromId === shape.id ? binding.toId : binding.fromId
      return !alsoDeleted.has(other)
    })
    this.delete(
      isolating.map(binding => binding.id),
      { isolateShapes: true }
    )
    this.editor.store.remove(bindings.map(binding => binding.id))
  }

  private all(): TLBinding[] {
    return this.editor.store.query('binding').get()
  }
}
