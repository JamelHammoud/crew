import { ArraySet } from './arraySet'
import { maybeCaptureParent } from './capture'
import { EMPTY_ARRAY, equals } from './graph'
import { HistoryBuffer } from './history'
import { advanceGlobalEpoch, atomDidChange, getGlobalEpoch } from './transactions'
import { RESET_VALUE } from './types'
import type { Atom, Child, ComputeDiff, AtomOptions, Parent } from './types'

export class _Atom<Value, Diff = unknown> implements Atom<Value, Diff>, Parent<Value, Diff> {
  readonly __isAtom = true
  lastChangedEpoch = getGlobalEpoch()
  readonly children = new ArraySet<Child>()
  historyBuffer?: HistoryBuffer<Diff>

  private readonly isEqual: ((a: any, b: any) => boolean) | null
  private readonly computeDiff?: ComputeDiff<Value, Diff>

  constructor(
    readonly name: string,
    private current: Value,
    options?: AtomOptions<Value, Diff>
  ) {
    this.isEqual = options?.isEqual ?? null
    if (!options) return
    if (options.historyLength) this.historyBuffer = new HistoryBuffer<Diff>(options.historyLength)
    this.computeDiff = options.computeDiff
  }

  __unsafe__getWithoutCapture(_ignoreErrors?: boolean): Value {
    return this.current
  }

  get(): Value {
    maybeCaptureParent(this)
    return this.current
  }

  set(value: Value, diff?: Diff): Value {
    if (this.isEqual?.(this.current, value) ?? equals(this.current, value)) return this.current

    advanceGlobalEpoch()

    if (this.historyBuffer) {
      this.historyBuffer.pushEntry(
        this.lastChangedEpoch,
        getGlobalEpoch(),
        diff ?? this.computeDiff?.(this.current, value, this.lastChangedEpoch, getGlobalEpoch()) ?? RESET_VALUE
      )
    }

    this.lastChangedEpoch = getGlobalEpoch()
    const oldValue = this.current
    this.current = value
    atomDidChange(this, oldValue)
    return value
  }

  update(updater: (value: Value) => Value): Value {
    return this.set(updater(this.current))
  }

  getDiffSince(epoch: number): Diff[] | RESET_VALUE {
    maybeCaptureParent(this)
    if (epoch >= this.lastChangedEpoch) return EMPTY_ARRAY
    return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE
  }
}

export function atom<Value, Diff = unknown>(
  name: string,
  initialValue: Value,
  options?: AtomOptions<Value, Diff>
): Atom<Value, Diff> {
  return new _Atom(name, initialValue, options)
}

export function isAtom(value: any): value is Atom<unknown> {
  return !!(value && value.__isAtom === true)
}
