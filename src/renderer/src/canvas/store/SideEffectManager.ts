import type { UnknownRecord } from './RecordType'
import type { ChangeSource, Store } from './Store'

export type BeforeCreateHandler<R extends UnknownRecord> = (record: R, source: ChangeSource) => R
export type AfterCreateHandler<R extends UnknownRecord> = (record: R, source: ChangeSource) => void
export type BeforeChangeHandler<R extends UnknownRecord> = (prev: R, next: R, source: ChangeSource) => R
export type AfterChangeHandler<R extends UnknownRecord> = (prev: R, next: R, source: ChangeSource) => void
export type BeforeDeleteHandler<R extends UnknownRecord> = (record: R, source: ChangeSource) => undefined | false
export type AfterDeleteHandler<R extends UnknownRecord> = (record: R, source: ChangeSource) => void
export type OperationCompleteHandler = (source: ChangeSource) => void

type Handlers<T> = { [typeName: string]: T[] | undefined }

export class SideEffectManager<R extends UnknownRecord> {
  constructor(readonly store: Store<R>) {}

  private beforeCreate: Handlers<BeforeCreateHandler<R>> = {}
  private afterCreate: Handlers<AfterCreateHandler<R>> = {}
  private beforeChange: Handlers<BeforeChangeHandler<R>> = {}
  private afterChange: Handlers<AfterChangeHandler<R>> = {}
  private beforeDelete: Handlers<BeforeDeleteHandler<R>> = {}
  private afterDelete: Handlers<AfterDeleteHandler<R>> = {}
  private operationComplete: OperationCompleteHandler[] = []
  private enabled = true

  isEnabled(): boolean {
    return this.enabled
  }

  setIsEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  handleBeforeCreate(record: R, source: ChangeSource): R {
    if (!this.enabled) return record
    const handlers = this.beforeCreate[record.typeName]
    if (!handlers) return record
    let next = record
    for (const handler of handlers) next = handler(next, source)
    return next
  }

  handleAfterCreate(record: R, source: ChangeSource): void {
    if (!this.enabled) return
    for (const handler of this.afterCreate[record.typeName] ?? []) handler(record, source)
  }

  handleBeforeChange(prev: R, next: R, source: ChangeSource): R {
    if (!this.enabled) return next
    const handlers = this.beforeChange[next.typeName]
    if (!handlers) return next
    let result = next
    for (const handler of handlers) result = handler(prev, result, source)
    return result
  }

  handleAfterChange(prev: R, next: R, source: ChangeSource): void {
    if (!this.enabled) return
    for (const handler of this.afterChange[next.typeName] ?? []) handler(prev, next, source)
  }

  handleBeforeDelete(record: R, source: ChangeSource): boolean {
    if (!this.enabled) return true
    for (const handler of this.beforeDelete[record.typeName] ?? []) {
      if (handler(record, source) === false) return false
    }
    return true
  }

  handleAfterDelete(record: R, source: ChangeSource): void {
    if (!this.enabled) return
    for (const handler of this.afterDelete[record.typeName] ?? []) handler(record, source)
  }

  handleOperationComplete(source: ChangeSource): void {
    if (!this.enabled) return
    for (const handler of this.operationComplete) handler(source)
  }

  registerBeforeCreateHandler<T extends R['typeName']>(
    typeName: T,
    handler: BeforeCreateHandler<Extract<R, { typeName: T }>>
  ): () => void {
    return add(this.beforeCreate, typeName, handler as unknown as BeforeCreateHandler<R>)
  }

  registerAfterCreateHandler<T extends R['typeName']>(
    typeName: T,
    handler: AfterCreateHandler<Extract<R, { typeName: T }>>
  ): () => void {
    return add(this.afterCreate, typeName, handler as unknown as AfterCreateHandler<R>)
  }

  registerBeforeChangeHandler<T extends R['typeName']>(
    typeName: T,
    handler: BeforeChangeHandler<Extract<R, { typeName: T }>>
  ): () => void {
    return add(this.beforeChange, typeName, handler as unknown as BeforeChangeHandler<R>)
  }

  registerAfterChangeHandler<T extends R['typeName']>(
    typeName: T,
    handler: AfterChangeHandler<Extract<R, { typeName: T }>>
  ): () => void {
    return add(this.afterChange, typeName, handler as unknown as AfterChangeHandler<R>)
  }

  registerBeforeDeleteHandler<T extends R['typeName']>(
    typeName: T,
    handler: BeforeDeleteHandler<Extract<R, { typeName: T }>>
  ): () => void {
    return add(this.beforeDelete, typeName, handler as unknown as BeforeDeleteHandler<R>)
  }

  registerAfterDeleteHandler<T extends R['typeName']>(
    typeName: T,
    handler: AfterDeleteHandler<Extract<R, { typeName: T }>>
  ): () => void {
    return add(this.afterDelete, typeName, handler as unknown as AfterDeleteHandler<R>)
  }

  registerOperationCompleteHandler(handler: OperationCompleteHandler): () => void {
    this.operationComplete.push(handler)
    return () => remove(this.operationComplete, handler)
  }
}

function add<T>(handlers: Handlers<T>, typeName: string, handler: T): () => void {
  const list = (handlers[typeName] ??= [])
  list.push(handler)
  return () => remove(list, handler)
}

function remove<T>(list: T[], item: T): void {
  const index = list.indexOf(item)
  if (index >= 0) list.splice(index, 1)
}
