import { ArraySet } from './arraySet'
import { startCapturingParents, stopCapturingParents } from './capture'
import { attach, detach, haveParentsChanged } from './graph'
import { getGlobalEpoch } from './transactions'
import { GLOBAL_START_EPOCH } from './types'
import type { Child, EffectSchedulerOptions, Parent } from './types'

export class EffectScheduler<Result> implements Child {
  readonly __isEffectScheduler = true

  lastTraversedEpoch = GLOBAL_START_EPOCH
  lastReactedEpoch = GLOBAL_START_EPOCH
  __debug_ancestor_epochs__: Map<Parent, number> | null = null

  readonly parentSet = new ArraySet<Parent>()
  readonly parents: Parent[] = []
  readonly parentEpochs: number[] = []

  private listening = false
  private scheduleCount_ = 0
  private readonly scheduleEffectFn?: (execute: () => void) => void

  constructor(
    readonly name: string,
    private readonly runEffect: (lastReactedEpoch: number) => Result,
    options?: EffectSchedulerOptions
  ) {
    this.scheduleEffectFn = options?.scheduleEffect
  }

  get isActivelyListening(): boolean {
    return this.listening
  }

  get scheduleCount(): number {
    return this.scheduleCount_
  }

  maybeScheduleEffect(): void {
    if (!this.listening) return
    if (this.lastReactedEpoch === getGlobalEpoch()) return
    if (this.parents.length && !haveParentsChanged(this)) {
      this.lastReactedEpoch = getGlobalEpoch()
      return
    }
    this.scheduleEffect()
  }

  scheduleEffect(): void {
    this.scheduleCount_++
    if (this.scheduleEffectFn) {
      this.scheduleEffectFn(this.maybeExecute)
      return
    }
    this.execute()
  }

  private readonly maybeExecute = (): void => {
    if (!this.listening) return
    this.execute()
  }

  attach(): void {
    this.listening = true
    for (let i = 0, n = this.parents.length; i < n; i++) {
      attach(this.parents[i], this)
    }
  }

  detach(): void {
    this.listening = false
    for (let i = 0, n = this.parents.length; i < n; i++) {
      detach(this.parents[i], this)
    }
  }

  execute(): Result {
    try {
      startCapturingParents(this)
      const currentEpoch = getGlobalEpoch()
      const result = this.runEffect(this.lastReactedEpoch)
      this.lastReactedEpoch = currentEpoch
      return result
    } finally {
      stopCapturingParents()
    }
  }
}

export function react(
  name: string,
  fn: (lastReactedEpoch: number) => void,
  options?: EffectSchedulerOptions
): () => void {
  const scheduler = new EffectScheduler(name, fn, options)
  scheduler.attach()
  scheduler.scheduleEffect()
  return () => scheduler.detach()
}

export interface Reactor<Result = unknown> {
  readonly scheduler: EffectScheduler<Result>
  start(options?: { force?: boolean }): void
  stop(): void
}

export function reactor<Result>(
  name: string,
  fn: (lastReactedEpoch: number) => Result,
  options?: EffectSchedulerOptions
): Reactor<Result> {
  const scheduler = new EffectScheduler(name, fn, options)
  return {
    scheduler,
    start: startOptions => {
      scheduler.attach()
      if (startOptions?.force) {
        scheduler.scheduleEffect()
      } else {
        scheduler.maybeScheduleEffect()
      }
    },
    stop: () => scheduler.detach()
  }
}
