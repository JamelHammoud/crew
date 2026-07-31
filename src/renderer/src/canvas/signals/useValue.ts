import { useMemo, useSyncExternalStore } from 'react'
import { unsafe__withoutCapture } from './capture'
import { computed } from './computed'
import { react } from './effect'
import type { Signal } from './types'

export function useValue<Value>(signal: Signal<Value>): Value
export function useValue<Value>(name: string, fn: () => Value, deps: unknown[]): Value
export function useValue<Value>(...args: [Signal<Value>] | [string, () => Value, unknown[]]): Value {
  const name = args.length === 3 ? args[0] : `useValue(${args[0].name})`
  const deps = args.length === 3 ? args[2] : [args[0]]
  const target = args.length === 3 ? args[1] : args[0]

  const { source, subscribe, getSnapshot } = useMemo(() => {
    const source = typeof target === 'function' ? computed<Value>(name, target) : target
    return {
      source,
      subscribe: (notify: () => void) =>
        react(`useValue(${name})`, () => {
          try {
            source.get()
          } catch {}
          notify()
        }),
      getSnapshot: () => source.lastChangedEpoch
    }
  }, deps)

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return unsafe__withoutCapture(() => source.__unsafe__getWithoutCapture())
}
