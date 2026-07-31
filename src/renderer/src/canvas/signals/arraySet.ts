export const ARRAY_SIZE_THRESHOLD = 8

export class ArraySet<T> {
  private arraySize = 0
  private array: (T | undefined)[] | null = new Array(ARRAY_SIZE_THRESHOLD)
  private set: Set<T> | null = null

  get isEmpty(): boolean {
    if (this.array) return this.arraySize === 0
    if (this.set) return this.set.size === 0
    throw new Error('no set or array')
  }

  add(elem: T): boolean {
    if (this.array) {
      const idx = this.array.indexOf(elem)
      if (idx !== -1) return false
      if (this.arraySize < ARRAY_SIZE_THRESHOLD) {
        this.array[this.arraySize] = elem
        this.arraySize++
        return true
      }
      this.set = new Set(this.array as T[])
      this.array = null
      this.set.add(elem)
      return true
    }
    if (this.set) {
      if (this.set.has(elem)) return false
      this.set.add(elem)
      return true
    }
    throw new Error('no set or array')
  }

  remove(elem: T): boolean {
    if (this.array) {
      const idx = this.array.indexOf(elem)
      if (idx === -1) return false
      this.array[idx] = undefined
      this.arraySize--
      if (idx !== this.arraySize) {
        this.array[idx] = this.array[this.arraySize]
        this.array[this.arraySize] = undefined
      }
      return true
    }
    if (this.set) {
      if (!this.set.has(elem)) return false
      this.set.delete(elem)
      return true
    }
    throw new Error('no set or array')
  }

  visit(visitor: (item: T) => void): void {
    if (this.array) {
      for (let i = 0; i < this.arraySize; i++) {
        const elem = this.array[i]
        if (typeof elem !== 'undefined') visitor(elem)
      }
      return
    }
    if (this.set) {
      this.set.forEach(visitor)
      return
    }
    throw new Error('no set or array')
  }

  *[Symbol.iterator](): Generator<T> {
    if (this.array) {
      for (let i = 0; i < this.arraySize; i++) {
        const elem = this.array[i]
        if (typeof elem !== 'undefined') yield elem
      }
      return
    }
    if (this.set) {
      yield* this.set
      return
    }
    throw new Error('no set or array')
  }

  has(elem: T): boolean {
    if (this.array) return this.array.indexOf(elem) !== -1
    if (this.set) return this.set.has(elem)
    throw new Error('no set or array')
  }

  clear(): void {
    if (this.set) {
      this.set.clear()
      return
    }
    this.arraySize = 0
    this.array = []
  }

  size(): number {
    if (this.set) return this.set.size
    return this.arraySize
  }
}
