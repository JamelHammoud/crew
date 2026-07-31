import type { ArraySet } from './arraySet'

export const GLOBAL_START_EPOCH = -1

export const RESET_VALUE: unique symbol = Symbol.for('crew.canvas.signals/RESET_VALUE')
export type RESET_VALUE = typeof RESET_VALUE

export type ComputeDiff<Value, Diff> = (
  previousValue: Value,
  currentValue: Value,
  lastComputedEpoch: number,
  currentEpoch: number
) => Diff | RESET_VALUE

export interface Signal<Value, Diff = unknown> {
  name: string
  get(): Value
  lastChangedEpoch: number
  getDiffSince(epoch: number): Diff[] | RESET_VALUE
  __unsafe__getWithoutCapture(ignoreErrors?: boolean): Value
}

export interface Parent<Value = any, Diff = any> extends Signal<Value, Diff> {
  children: ArraySet<Child>
}

export interface Child {
  readonly name: string
  lastTraversedEpoch: number
  readonly parentSet: ArraySet<Parent>
  readonly parents: Parent[]
  readonly parentEpochs: number[]
  isActivelyListening: boolean
  __debug_ancestor_epochs__: Map<Parent, number> | null
}

export interface Atom<Value, Diff = unknown> extends Signal<Value, Diff> {
  set(value: Value, diff?: Diff): Value
  update(updater: (value: Value) => Value): Value
}

export interface Computed<Value, Diff = unknown> extends Signal<Value, Diff> {
  readonly isActivelyListening: boolean
  lastTraversedEpoch: number
}

export interface AtomOptions<Value, Diff> {
  historyLength?: number
  computeDiff?: ComputeDiff<Value, Diff>
  isEqual?(a: any, b: any): boolean
}

export interface ComputedOptions<Value, Diff> {
  historyLength?: number
  computeDiff?: ComputeDiff<Value, Diff>
  isEqual?(a: any, b: any): boolean
}

export interface EffectSchedulerOptions {
  scheduleEffect?(execute: () => void): void
}
