import { useMemo } from 'react'
import { computed } from './computed'
import type { Computed, ComputedOptions } from './types'

export function useComputed<Value>(name: string, compute: () => Value, deps: unknown[]): Computed<Value>
export function useComputed<Value, Diff = unknown>(
  name: string,
  compute: () => Value,
  opts: ComputedOptions<Value, Diff>,
  deps: unknown[]
): Computed<Value, Diff>
export function useComputed(...args: any[]): Computed<any, any> {
  const name = args[0] as string
  const compute = args[1] as () => any
  const opts = args.length === 3 ? undefined : (args[2] as ComputedOptions<any, any>)
  const deps = args.length === 3 ? (args[2] as unknown[]) : (args[3] as unknown[])
  return useMemo(() => computed(`useComputed(${name})`, compute, opts), deps)
}
