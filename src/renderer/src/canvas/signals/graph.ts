import type { Child, Parent } from './types'

export const EMPTY_ARRAY = Object.freeze([]) as never

function isChild(x: Parent): x is Parent & Child {
  return 'parents' in x
}

export function equals(a: any, b: any): boolean {
  return a === b || Object.is(a, b) || Boolean(a && b && typeof a.equals === 'function' && a.equals(b))
}

export function haveParentsChanged(child: Child): boolean {
  for (let i = 0, n = child.parents.length; i < n; i++) {
    child.parents[i].__unsafe__getWithoutCapture(true)
    if (child.parents[i].lastChangedEpoch !== child.parentEpochs[i]) return true
  }
  return false
}

export function detach(parent: Parent, child: Child): void {
  if (!parent.children.remove(child)) return
  if (parent.children.isEmpty && isChild(parent)) {
    for (let i = 0, n = parent.parents.length; i < n; i++) {
      detach(parent.parents[i], parent)
    }
  }
}

export function attach(parent: Parent, child: Child): void {
  if (!parent.children.add(child)) return
  if (isChild(parent)) {
    for (let i = 0, n = parent.parents.length; i < n; i++) {
      attach(parent.parents[i], parent)
    }
  }
}

export function hasReactors(signal: Parent): boolean {
  for (const child of signal.children) {
    if (child.isActivelyListening) return true
  }
  return false
}
