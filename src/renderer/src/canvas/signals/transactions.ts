import { GLOBAL_START_EPOCH } from './types'
import type { Child, Parent } from './types'
import type { _Atom } from './atom'

type AnyAtom = _Atom<any, any>

interface Reactor {
  maybeScheduleEffect(): void
}

let globalEpoch = GLOBAL_START_EPOCH + 1
let globalIsReacting = false
let currentTransaction: Transaction | null = null
let cleanupReactors: Set<Reactor> | null = null
let reactionEpoch = GLOBAL_START_EPOCH + 1

class Transaction {
  readonly initialAtomValues = new Map<AnyAtom, unknown>()

  constructor(readonly parent: Transaction | null) {}

  get isRoot(): boolean {
    return this.parent === null
  }

  commit(): void {
    if (globalIsReacting) {
      for (const atom of this.initialAtomValues.keys()) {
        traverseAtomForCleanup(atom)
      }
    } else if (this.isRoot) {
      flushChanges(this.initialAtomValues.keys())
    } else {
      const parent = this.parent!
      this.initialAtomValues.forEach((value, atom) => {
        if (!parent.initialAtomValues.has(atom)) parent.initialAtomValues.set(atom, value)
      })
    }
  }

  abort(): void {
    globalEpoch++
    this.initialAtomValues.forEach((value, atom) => {
      atom.set(value)
      atom.historyBuffer?.clear()
    })
    this.commit()
  }
}

export function getGlobalEpoch(): number {
  return globalEpoch
}

export function getIsReacting(): boolean {
  return globalIsReacting
}

export function getReactionEpoch(): number {
  return reactionEpoch
}

export function advanceGlobalEpoch(): void {
  globalEpoch++
}

let traverseReactors: Set<Reactor> | undefined

function traverseChild(child: Child): void {
  if (child.lastTraversedEpoch === globalEpoch) return
  child.lastTraversedEpoch = globalEpoch
  if ('__isEffectScheduler' in child) {
    traverseReactors!.add(child as unknown as Reactor)
    return
  }
  ;(child as unknown as Parent).children.visit(traverseChild)
}

function traverse(reactors: Set<Reactor>, child: Child): void {
  traverseReactors = reactors
  traverseChild(child)
}

export function flushChanges(atoms: Iterable<AnyAtom>): void {
  if (globalIsReacting) throw new Error('flushChanges cannot be called during a reaction')
  const outerTxn = currentTransaction
  try {
    currentTransaction = null
    globalIsReacting = true
    reactionEpoch = globalEpoch

    const reactors = new Set<Reactor>()
    for (const atom of atoms) {
      atom.children.visit(child => traverse(reactors, child))
    }
    for (const r of reactors) {
      r.maybeScheduleEffect()
    }

    let updateDepth = 0
    while (cleanupReactors?.size) {
      if (updateDepth++ > 1000) throw new Error('Reaction update depth limit exceeded')
      const draining = cleanupReactors
      cleanupReactors = null
      for (const r of draining) {
        r.maybeScheduleEffect()
      }
    }
  } finally {
    cleanupReactors = null
    globalIsReacting = false
    currentTransaction = outerTxn
    traverseReactors = undefined
  }
}

function traverseAtomForCleanup(atom: AnyAtom): void {
  const rs = (cleanupReactors ??= new Set())
  atom.children.visit(child => traverse(rs, child))
}

export function atomDidChange(atom: AnyAtom, previousValue: unknown): void {
  if (currentTransaction) {
    if (!currentTransaction.initialAtomValues.has(atom)) {
      currentTransaction.initialAtomValues.set(atom, previousValue)
    }
    return
  }
  if (globalIsReacting) {
    traverseAtomForCleanup(atom)
    return
  }
  flushChanges([atom])
}

export function transaction<Result>(fn: (rollback: () => void) => Result): Result {
  const txn = new Transaction(currentTransaction)
  currentTransaction = txn
  try {
    let result: Result
    let rollback = false
    try {
      result = fn(() => (rollback = true))
    } catch (e) {
      txn.abort()
      throw e
    }
    if (currentTransaction !== txn) throw new Error('Transaction boundaries overlap')
    if (rollback) {
      txn.abort()
    } else {
      txn.commit()
    }
    return result
  } finally {
    currentTransaction = txn.parent
  }
}

export function transact<Result>(fn: () => Result): Result {
  if (currentTransaction) return fn()
  return transaction(fn)
}
