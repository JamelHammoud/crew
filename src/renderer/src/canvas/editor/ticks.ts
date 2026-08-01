const MAX_FRAME_MS = 50

export class TickManager {
  private cancel: (() => void) | null = null
  private paused = true
  private last = 0

  constructor(private readonly onTick: (elapsed: number) => void) {}

  start(): void {
    if (!this.paused) return
    this.paused = false
    this.last = now()
    this.schedule()
  }

  dispose(): void {
    this.paused = true
    this.cancel?.()
    this.cancel = null
  }

  private schedule(): void {
    if (typeof requestAnimationFrame === 'undefined') {
      const handle = setTimeout(() => this.tick(), 16)
      this.cancel = () => clearTimeout(handle)
      return
    }
    const handle = requestAnimationFrame(() => this.tick())
    this.cancel = () => cancelAnimationFrame(handle)
  }

  private tick(): void {
    if (this.paused) return
    const current = now()
    const elapsed = Math.min(MAX_FRAME_MS, current - this.last)
    this.last = current
    this.onTick(elapsed)
    this.schedule()
  }
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}
