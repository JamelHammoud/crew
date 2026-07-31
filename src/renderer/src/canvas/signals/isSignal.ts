import { isAtom } from './atom'
import { isComputed } from './isComputed'
import type { Signal } from './types'

export function isSignal(value: any): value is Signal<unknown> {
  return isAtom(value) || isComputed(value)
}
