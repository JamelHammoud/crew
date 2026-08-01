import { HistoryManager } from '../store'
import type { TLRecord } from '../schema'
import type { Store } from '../store'

export class EditorHistory {
  private readonly manager: HistoryManager<TLRecord>

  constructor(store: Store<TLRecord>) {
    this.manager = new HistoryManager({ store })
  }

  get dispose(): () => void {
    return this.manager.dispose
  }

  getNumUndos(): number {
    return this.manager.getNumUndos()
  }

  getNumRedos(): number {
    return this.manager.getNumRedos()
  }

  markHistoryStoppingPoint(name?: string): string {
    return this.manager.markHistoryStoppingPoint(name)
  }

  squashToMark(id: string): void {
    this.manager.squashToMark(id)
  }

  undo(): void {
    this.manager.undo()
  }

  bail(): void {
    this.manager.bail()
  }

  redo(): void {
    this.manager.redo()
  }

  bailToMark(id: string): void {
    this.manager.bailToMark(id)
  }

  ignore<T>(fn: () => T): T {
    return this.manager.ignore(fn)
  }
}
