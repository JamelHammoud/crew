import { attach, detach } from './graph'
import { captureAncestorEpochs, logChangedAncestors } from './why'
import type { Child, Parent } from './types'

class CaptureStackFrame {
  offset = 0
  maybeRemoved: Parent[] | undefined

  constructor(
    readonly below: CaptureStackFrame | null,
    readonly child: Child
  ) {}
}

let stack: CaptureStackFrame | null = null

export function unsafe__withoutCapture<Result>(fn: () => Result): Result {
  const oldStack = stack
  stack = null
  try {
    return fn()
  } finally {
    stack = oldStack
  }
}

export function startCapturingParents(child: Child): void {
  stack = new CaptureStackFrame(stack, child)
  if (child.__debug_ancestor_epochs__) {
    const previousAncestorEpochs = child.__debug_ancestor_epochs__
    child.__debug_ancestor_epochs__ = null
    for (const p of child.parents) {
      p.__unsafe__getWithoutCapture(true)
    }
    logChangedAncestors(child, previousAncestorEpochs)
  }
  child.parentSet.clear()
}

export function stopCapturingParents(): void {
  const frame = stack
  if (!frame) throw new Error('stopCapturingParents called outside of a capture')
  stack = frame.below
  const { child } = frame
  if (frame.offset < child.parents.length) {
    for (let i = frame.offset; i < child.parents.length; i++) {
      const maybeRemovedParent = child.parents[i]
      if (!child.parentSet.has(maybeRemovedParent)) detach(maybeRemovedParent, child)
    }
    child.parents.length = frame.offset
    child.parentEpochs.length = frame.offset
  }
  if (frame.maybeRemoved) {
    for (let i = 0; i < frame.maybeRemoved.length; i++) {
      const maybeRemovedParent = frame.maybeRemoved[i]
      if (!child.parentSet.has(maybeRemovedParent)) detach(maybeRemovedParent, child)
    }
  }
  if (child.__debug_ancestor_epochs__) captureAncestorEpochs(child, child.__debug_ancestor_epochs__)
}

export function maybeCaptureParent(p: Parent): void {
  if (!stack) return
  const { child, offset } = stack
  if (child.parentSet.has(p)) return
  child.parentSet.add(p)
  if (child.isActivelyListening) attach(p, child)
  if (offset < child.parents.length) {
    const maybeRemovedParent = child.parents[offset]
    if (maybeRemovedParent !== p) {
      if (!stack.maybeRemoved) {
        stack.maybeRemoved = [maybeRemovedParent]
      } else {
        stack.maybeRemoved.push(maybeRemovedParent)
      }
    }
  }
  child.parents[offset] = p
  child.parentEpochs[offset] = p.lastChangedEpoch
  stack.offset++
}

export function whyAmIRunning(): void {
  const child = stack?.child
  if (!child) throw new Error('whyAmIRunning() called outside of a reactive context')
  child.__debug_ancestor_epochs__ = new Map()
}
