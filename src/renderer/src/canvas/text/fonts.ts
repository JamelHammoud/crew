export interface FontLoadFace {
  family?: string
}

export interface FontLoadingEventLike extends Event {
  fontfaces?: FontLoadFace[]
}

export interface FontFaceSetLike {
  readonly ready: Promise<unknown>
  load(font: string, text?: string): Promise<unknown>
  addEventListener(type: 'loadingdone' | 'loadingerror', listener: EventListener): void
  removeEventListener(type: 'loadingdone' | 'loadingerror', listener: EventListener): void
}

export class FontTracker {
  private readonly families = new Set<string>()
  private readonly listeners = new Set<(revision: number) => void>()
  private revision = 0
  private disposed = false
  private readySettled = false

  private readonly onLoading = (event: Event) => {
    const faces = (event as FontLoadingEventLike).fontfaces
    if (!faces || faces.length === 0 || faces.some(face => face.family && this.families.has(face.family))) {
      this.invalidate()
    }
  }

  constructor(private readonly fonts: FontFaceSetLike | null | undefined) {
    fonts?.addEventListener('loadingdone', this.onLoading)
    fonts?.addEventListener('loadingerror', this.onLoading)
    void fonts?.ready.then(
      () => {
        if (this.readySettled) return
        this.readySettled = true
        this.invalidate()
      },
      () => {
        if (this.readySettled) return
        this.readySettled = true
        this.invalidate()
      }
    )
  }

  get generation(): number {
    return this.revision
  }

  track(families: string | Iterable<string>): number {
    const values = typeof families === 'string' ? [families] : families
    for (const family of values) this.families.add(family)
    return this.revision
  }

  async load(font: string, text?: string): Promise<void> {
    if (!this.fonts) return
    const before = this.revision
    try {
      await this.fonts.load(font, text)
    } finally {
      if (this.revision === before) this.invalidate()
    }
  }

  subscribe(listener: (revision: number) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  invalidate(): void {
    if (this.disposed) return
    this.revision++
    for (const listener of this.listeners) listener(this.revision)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.fonts?.removeEventListener('loadingdone', this.onLoading)
    this.fonts?.removeEventListener('loadingerror', this.onLoading)
    this.listeners.clear()
    this.families.clear()
  }
}

interface CachedMeasurement<Value> {
  revision: number
  signature: string
  value: Value
}

export class FontMeasurementCache<Key extends object, Value> {
  private cache = new WeakMap<Key, CachedMeasurement<Value>>()

  constructor(private readonly fonts: FontTracker) {}

  get(key: Key, signature: string, measure: () => Value): Value {
    const cached = this.cache.get(key)
    if (cached && cached.revision === this.fonts.generation && cached.signature === signature) return cached.value
    const value = measure()
    this.cache.set(key, { revision: this.fonts.generation, signature, value })
    return value
  }

  clear(): void {
    this.cache = new WeakMap()
  }
}
