import { ArraySet } from './arraySet'
import { maybeCaptureParent, startCapturingParents, stopCapturingParents } from './capture'
import { EMPTY_ARRAY, equals, haveParentsChanged } from './graph'
import { HistoryBuffer } from './history'
import { isComputed } from './isComputed'
import { getGlobalEpoch, getIsReacting, getReactionEpoch } from './transactions'
import { GLOBAL_START_EPOCH, RESET_VALUE } from './types'
import type { Child, Computed, ComputeDiff, ComputedOptions, Parent } from './types'

export const UNINITIALIZED: unique symbol = Symbol.for('crew.canvas.signals/UNINITIALIZED')
export type UNINITIALIZED = typeof UNINITIALIZED

export function isUninitialized(value: any): value is UNINITIALIZED {
  return value === UNINITIALIZED
}

export class WithDiff<Value, Diff> {
  constructor(
    readonly value: Value,
    readonly diff: Diff
  ) {}
}

export function withDiff<Value, Diff>(value: Value, diff: Diff): WithDiff<Value, Diff> {
  return new WithDiff(value, diff)
}

export type Derive<Value, Diff> = (
  previousValue: Value | UNINITIALIZED,
  lastComputedEpoch: number
) => Value | WithDiff<Value, Diff>

export class _Computed<Value, Diff = unknown> implements Computed<Value, Diff>, Parent<Value, Diff>, Child {
  readonly __isComputed = true
  lastChangedEpoch = GLOBAL_START_EPOCH
  lastTraversedEpoch = GLOBAL_START_EPOCH
  lastCheckedEpoch = GLOBAL_START_EPOCH
  __debug_ancestor_epochs__: Map<Parent, number> | null = null

  readonly parentSet = new ArraySet<Parent>()
  readonly parents: Parent[] = []
  readonly parentEpochs: number[] = []
  readonly children = new ArraySet<Child>()

  historyBuffer?: HistoryBuffer<Diff>

  private state: Value | UNINITIALIZED = UNINITIALIZED
  private error: { thrownValue: unknown } | null = null
  private readonly computeDiff?: ComputeDiff<Value, Diff>
  private readonly isEqual: (a: any, b: any) => boolean

  constructor(
    readonly name: string,
    private readonly derive: Derive<Value, Diff>,
    options?: ComputedOptions<Value, Diff>
  ) {
    if (options?.historyLength) this.historyBuffer = new HistoryBuffer<Diff>(options.historyLength)
    this.computeDiff = options?.computeDiff
    this.isEqual = options?.isEqual ?? equals
  }

  get isActivelyListening(): boolean {
    return !this.children.isEmpty
  }

  __unsafe__getWithoutCapture(ignoreErrors?: boolean): Value {
    const isNew = this.lastChangedEpoch === GLOBAL_START_EPOCH
    const globalEpoch = getGlobalEpoch()

    if (
      !isNew &&
      (this.lastCheckedEpoch === globalEpoch ||
        (this.isActivelyListening && getIsReacting() && this.lastTraversedEpoch < getReactionEpoch()) ||
        !haveParentsChanged(this))
    ) {
      this.lastCheckedEpoch = globalEpoch
      if (this.error && !ignoreErrors) throw this.error.thrownValue
      return this.state as Value
    }

    try {
      startCapturingParents(this)
      const result = this.derive(this.state, this.lastCheckedEpoch)
      const newState = result instanceof WithDiff ? result.value : (result as Value)
      const wasUninitialized = this.state === UNINITIALIZED

      if (wasUninitialized || !this.isEqual(this.state, newState)) {
        if (this.historyBuffer && !wasUninitialized) {
          const diff = result instanceof WithDiff ? result.diff : undefined
          this.historyBuffer.pushEntry(
            this.lastChangedEpoch,
            getGlobalEpoch(),
            diff ??
              this.computeDiff?.(this.state as Value, newState, this.lastCheckedEpoch, getGlobalEpoch()) ??
              RESET_VALUE
          )
        }
        this.lastChangedEpoch = getGlobalEpoch()
        this.state = newState
      }

      this.error = null
      this.lastCheckedEpoch = getGlobalEpoch()
      return this.state as Value
    } catch (e) {
      if (this.state !== UNINITIALIZED) {
        this.state = UNINITIALIZED
        this.lastChangedEpoch = getGlobalEpoch()
      }
      this.lastCheckedEpoch = getGlobalEpoch()
      this.historyBuffer?.clear()
      this.error = { thrownValue: e }
      if (!ignoreErrors) throw e
      return this.state as Value
    } finally {
      stopCapturingParents()
    }
  }

  get(): Value {
    try {
      return this.__unsafe__getWithoutCapture()
    } finally {
      maybeCaptureParent(this)
    }
  }

  getDiffSince(epoch: number): Diff[] | RESET_VALUE {
    this.__unsafe__getWithoutCapture(true)
    maybeCaptureParent(this)
    if (epoch >= this.lastChangedEpoch) return EMPTY_ARRAY
    return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE
  }
}

const IS_COMPUTED_METHOD = '@@__isComputedMethod__@@'

function derivationKey(name: string): symbol {
  return Symbol.for('crew.canvas.signals/computed/' + name)
}

function instanceOn(host: any, key: symbol, name: string, compute: () => any, options?: ComputedOptions<any, any>) {
  let derivation = host[key]
  if (!derivation) {
    derivation = new _Computed(name, compute.bind(host), options)
    Object.defineProperty(host, key, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: derivation
    })
  }
  return derivation as _Computed<any, any>
}

function legacyDecorator(options: ComputedOptions<any, any> | undefined, key: string, descriptor: any) {
  const original = descriptor.value ?? descriptor.get
  if (!original) throw new Error('@computed can only be used on methods and getters')
  const symbol = derivationKey(key)
  const wrapped = function (this: any) {
    return instanceOn(this, symbol, key, original, options).get()
  }
  wrapped[IS_COMPUTED_METHOD] = true
  if (descriptor.value) {
    descriptor.value = wrapped
  } else {
    descriptor.get = wrapped
  }
  return descriptor
}

function methodDecorator(options: ComputedOptions<any, any> | undefined, compute: () => any, context: any) {
  if (context.kind !== 'method') throw new Error('@computed can only be used on methods')
  const name = String(context.name)
  const symbol = derivationKey(name)
  const wrapped = function (this: any) {
    return instanceOn(this, symbol, name, compute, options).get()
  }
  wrapped[IS_COMPUTED_METHOD] = true
  return wrapped
}

function decorate(options: ComputedOptions<any, any> | undefined, args: any[]) {
  if (args.length === 2) return methodDecorator(options, args[0], args[1])
  return legacyDecorator(options, args[1], args[2])
}

export function getComputedInstance<Obj extends object, Prop extends keyof Obj>(
  obj: Obj,
  propertyName: Prop
): _Computed<Obj[Prop]> {
  const key = derivationKey(propertyName.toString())
  const host = obj as any
  let instance = host[key]
  if (!instance) {
    const val = host[propertyName]
    if (typeof val === 'function' && val[IS_COMPUTED_METHOD]) val.call(obj)
    instance = host[key]
  }
  return instance
}

export function computed<Value, Diff = unknown>(
  name: string,
  compute: Derive<Value, Diff>,
  options?: ComputedOptions<Value, Diff>
): Computed<Value, Diff>
export function computed(options: ComputedOptions<any, any>): (...args: any[]) => any
export function computed(...args: any[]): any
export function computed(...args: any[]): any {
  if (args.length === 1 && typeof args[0] !== 'string') {
    const options = args[0] as ComputedOptions<any, any>
    return (...decoratorArgs: any[]) => decorate(options, decoratorArgs)
  }
  if (typeof args[0] === 'string') return new _Computed(args[0], args[1], args[2])
  return decorate(undefined, args)
}

export { isComputed }
