import { atom, transact, unsafe__withoutCapture } from '../signals'
import {
  createEmptyRecordsDiff,
  hasAnyKey,
  isRecordsDiffEmpty,
  reverseRecordsDiff,
  squashRecordDiffsMutable,
  type RecordsDiff
} from './RecordsDiff'
import type { UnknownRecord } from './RecordType'
import type { Store } from './Store'
import { uniqueId } from './uniqueId'

export type HistoryStackEntry<R extends UnknownRecord> =
  | { type: 'diff'; diff: RecordsDiff<R> }
  | { type: 'stop'; id: string }

type RecorderState = 'recording' | 'recordingPreserveRedoStack' | 'paused'

export class HistoryManager<R extends UnknownRecord> {
  readonly dispose: () => void

  private readonly store: Store<R>
  private state: RecorderState = 'recording'
  private readonly pendingDiff = new PendingDiff<R>()
  private readonly stacks = atom(
    'history.stacks',
    {
      undos: stack<HistoryStackEntry<R>>(),
      redos: stack<HistoryStackEntry<R>>()
    },
    { isEqual: (a, b) => a.undos === b.undos && a.redos === b.redos }
  )

  constructor(opts: { store: Store<R> }) {
    this.store = opts.store
    this.dispose = this.store.addHistoryInterceptor((entry, source) => {
      if (source !== 'user') return
      switch (this.state) {
        case 'recording':
          this.pendingDiff.apply(entry.changes)
          if (this.stacks.get().redos.length > 0) {
            this.stacks.update(({ undos }) => ({ undos, redos: stack<HistoryStackEntry<R>>() }))
          }
          break
        case 'recordingPreserveRedoStack':
          this.pendingDiff.apply(entry.changes)
          break
        case 'paused':
          break
      }
    })
  }

  getNumUndos(): number {
    return this.stacks.get().undos.length + (this.pendingDiff.isEmpty() ? 0 : 1)
  }

  getNumRedos(): number {
    return this.stacks.get().redos.length
  }

  markHistoryStoppingPoint(name?: string): string {
    const id = `[${name ?? 'stop'}]_${uniqueId()}`
    transact(() => {
      this.flushPendingDiff()
      this.stacks.update(({ undos, redos }) => ({ undos: undos.push({ type: 'stop', id }), redos }))
    })
    return id
  }

  squashToMark(id: string): this {
    let top = this.stacks.get().undos
    const popped: RecordsDiff<R>[] = []

    while (top.head && !(top.head.type === 'stop' && top.head.id === id)) {
      if (top.head.type === 'diff') popped.push(top.head.diff)
      top = top.tail
    }

    if (!top.head || top.head.type !== 'stop' || top.head.id !== id) return this
    if (popped.length === 0) return this

    const diff = createEmptyRecordsDiff<R>()
    squashRecordDiffsMutable(diff, popped.reverse())

    const squashed = top
    this.stacks.update(({ redos }) => ({ undos: squashed.push({ type: 'diff', diff }), redos }))
    return this
  }

  undo(): this {
    this.replay({ pushToRedoStack: true })
    return this
  }

  bail(): this {
    this.replay({ pushToRedoStack: false })
    return this
  }

  bailToMark(id: string): this {
    if (id) this.replay({ pushToRedoStack: false, toMark: id })
    return this
  }

  redo(): this {
    const previousState = this.state
    this.state = 'paused'
    try {
      this.flushPendingDiff()

      let { undos, redos } = this.stacks.get()
      if (redos.length === 0) return this

      while (redos.head?.type === 'stop') {
        undos = undos.push(redos.head)
        redos = redos.tail
      }

      const diffToRedo = createEmptyRecordsDiff<R>()
      while (redos.head) {
        const redo = redos.head
        undos = undos.push(redo)
        redos = redos.tail
        if (redo.type === 'diff') squashRecordDiffsMutable(diffToRedo, [redo.diff])
        else break
      }

      this.store.applyDiff(diffToRedo, { ignoreEphemeralKeys: true })
      this.stacks.set({ undos, redos })
    } finally {
      this.state = previousState
    }
    return this
  }

  ignore<T>(fn: () => T): T {
    const previousState = this.state
    this.state = 'paused'
    try {
      return transact(fn)
    } finally {
      this.state = previousState
    }
  }

  clear(): void {
    this.stacks.set({ undos: stack<HistoryStackEntry<R>>(), redos: stack<HistoryStackEntry<R>>() })
    this.pendingDiff.clear()
  }

  getMarkIdMatching(idSubstring: string): string | null {
    let top = this.stacks.get().undos
    while (top.head) {
      if (top.head.type === 'stop' && top.head.id.includes(idSubstring)) return top.head.id
      top = top.tail
    }
    return null
  }

  private flushPendingDiff(): void {
    if (this.pendingDiff.isEmpty()) return
    const diff = this.pendingDiff.clear()
    this.stacks.update(({ undos, redos }) => ({ undos: undos.push({ type: 'diff', diff }), redos }))
  }

  private replay({ pushToRedoStack, toMark }: { pushToRedoStack: boolean; toMark?: string }): void {
    const previousState = this.state
    this.state = 'paused'
    try {
      let { undos, redos } = this.stacks.get()

      const pendingDiff = this.pendingDiff.clear()
      const isPendingDiffEmpty = isRecordsDiffEmpty(pendingDiff)
      const diffToUndo = reverseRecordsDiff(pendingDiff)

      if (pushToRedoStack && !isPendingDiffEmpty) {
        redos = redos.push({ type: 'diff', diff: pendingDiff })
      }

      let didFindMark = false
      if (isPendingDiffEmpty) {
        while (undos.head?.type === 'stop') {
          const mark = undos.head
          undos = undos.tail
          if (pushToRedoStack) redos = redos.push(mark)
          if (mark.id === toMark) {
            didFindMark = true
            break
          }
        }
      }

      if (!didFindMark) {
        loop: while (undos.head) {
          const undo = undos.head
          undos = undos.tail
          if (pushToRedoStack) redos = redos.push(undo)
          switch (undo.type) {
            case 'diff':
              squashRecordDiffsMutable(diffToUndo, [reverseRecordsDiff(undo.diff)])
              break
            case 'stop':
              if (!toMark) break loop
              if (undo.id === toMark) {
                didFindMark = true
                break loop
              }
              break
          }
        }
      }

      if (!didFindMark && toMark) {
        this.pendingDiff.restore(pendingDiff)
        return
      }

      this.store.applyDiff(diffToUndo, { ignoreEphemeralKeys: true })
      this.stacks.set({ undos, redos })
    } finally {
      this.state = previousState
    }
  }
}

class PendingDiff<R extends UnknownRecord> {
  private diff = createEmptyRecordsDiff<R>()
  private isEmptyAtom = atom('history.pendingDiff.isEmpty', true)

  clear(): RecordsDiff<R> {
    const diff = this.diff
    this.diff = createEmptyRecordsDiff<R>()
    this.isEmptyAtom.set(true)
    return diff
  }

  restore(diff: RecordsDiff<R>): void {
    this.diff = diff
    this.isEmptyAtom.set(isRecordsDiffEmpty(diff))
  }

  isEmpty(): boolean {
    return this.isEmptyAtom.get()
  }

  apply(diff: RecordsDiff<R>): void {
    squashRecordDiffsMutable(this.diff, [diff])
    if (hasAnyKey(diff.added) || hasAnyKey(diff.removed)) {
      this.isEmptyAtom.set(isRecordsDiffEmpty(this.diff))
    } else if (unsafe__withoutCapture(() => this.isEmptyAtom.get())) {
      this.isEmptyAtom.set(!hasAnyKey(diff.updated))
    }
  }
}

interface Stack<T> {
  readonly length: number
  readonly head: T | null
  readonly tail: Stack<T>
  push(head: T): Stack<T>
}

class EmptyStackItem<T> implements Stack<T> {
  readonly length = 0
  readonly head = null
  readonly tail: Stack<T> = this

  push(head: T): Stack<T> {
    return new StackItem<T>(head, this)
  }
}

const EMPTY_STACK_ITEM = new EmptyStackItem<never>()

class StackItem<T> implements Stack<T> {
  readonly length: number

  constructor(
    readonly head: T,
    readonly tail: Stack<T>
  ) {
    this.length = tail.length + 1
  }

  push(head: T): Stack<T> {
    return new StackItem(head, this)
  }
}

function stack<T>(): Stack<T> {
  return EMPTY_STACK_ITEM as unknown as Stack<T>
}
