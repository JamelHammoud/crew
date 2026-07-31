import { atom } from '../signals'
import {
  snapResizeBounds,
  snapTranslateBounds,
  type BoundsSnapIndicator,
  type ResizeBoundsSnapOptions,
  type TranslateBoundsSnapOptions
} from '../tools/snaps'

export class SnapManager {
  private readonly indicators = atom<BoundsSnapIndicator[]>('canvas snap indicators', [])

  getIndicators(): BoundsSnapIndicator[] {
    return this.indicators.get()
  }

  setIndicators(indicators: BoundsSnapIndicator[]): void {
    this.indicators.set(indicators)
  }

  clearIndicators(): void {
    this.indicators.set([])
  }

  snapTranslateBounds(options: TranslateBoundsSnapOptions) {
    return snapTranslateBounds(options)
  }

  snapResizeBounds(options: ResizeBoundsSnapOptions) {
    return snapResizeBounds(options)
  }
}
