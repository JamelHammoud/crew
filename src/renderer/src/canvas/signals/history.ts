import { RESET_VALUE } from './types'

export class HistoryBuffer<Diff> {
  private index = 0
  private readonly buffer: ([number, number, Diff] | undefined)[]

  constructor(private readonly capacity: number) {
    this.buffer = new Array(capacity)
  }

  pushEntry(lastComputedEpoch: number, currentEpoch: number, diff: Diff | RESET_VALUE | undefined): void {
    if (diff === undefined) return
    if (diff === RESET_VALUE) {
      this.clear()
      return
    }
    this.buffer[this.index] = [lastComputedEpoch, currentEpoch, diff as Diff]
    this.index = (this.index + 1) % this.capacity
  }

  clear(): void {
    this.index = 0
    this.buffer.fill(undefined)
  }

  getChangesSince(sinceEpoch: number): Diff[] | RESET_VALUE {
    const { index, capacity, buffer } = this
    for (let i = 0; i < capacity; i++) {
      const offset = (index - 1 + capacity - i) % capacity
      const elem = buffer[offset]
      if (!elem) return RESET_VALUE
      const [fromEpoch, toEpoch] = elem
      if (i === 0 && sinceEpoch >= toEpoch) return []
      if (fromEpoch <= sinceEpoch && sinceEpoch < toEpoch) {
        const len = i + 1
        const result = new Array<Diff>(len)
        for (let j = 0; j < len; j++) {
          result[j] = buffer[(offset + j) % capacity]![2]
        }
        return result
      }
    }
    return RESET_VALUE
  }
}
