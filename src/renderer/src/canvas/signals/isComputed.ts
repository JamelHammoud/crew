import type { Computed } from './types'

export function isComputed(value: any): value is Computed<any> {
  return !!(value && value.__isComputed === true)
}
