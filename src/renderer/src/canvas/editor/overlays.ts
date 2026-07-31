import type { CanvasOverlay, CanvasOverlayEntry, CanvasOverlayUtil } from '../render/types'

const inactive: CanvasOverlayUtil = {
  isActive: () => false,
  render: () => undefined
}

export class OverlayManager {
  private readonly values = new Map<string, unknown>()

  constructor(constructors: readonly unknown[] = []) {
    for (const Constructor of constructors) {
      const value = typeof Constructor === 'function' ? new (Constructor as new () => unknown)() : Constructor
      const id = overlayId(value)
      if (id) this.values.set(id, value)
    }
  }

  get(id: string): unknown {
    return this.values.get(id)
  }

  all(): unknown[] {
    return [...this.values.values()]
  }

  getActiveOverlayEntries(): CanvasOverlayEntry[] {
    const entries: CanvasOverlayEntry[] = []
    for (const value of this.values.values()) {
      if (!isOverlayUtil(value) || !value.isActive()) continue
      const overlays = typeof (value as { getOverlays?: () => CanvasOverlay[] }).getOverlays === 'function'
        ? (value as { getOverlays: () => CanvasOverlay[] }).getOverlays()
        : []
      entries.push({ util: value, overlays })
    }
    return entries
  }

  getOverlayUtil(type: string): CanvasOverlayUtil {
    const value = this.values.get(type)
    return isOverlayUtil(value) ? value : inactive
  }
}

function overlayId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const id = (value as { id?: unknown }).id ?? (value as { constructor?: { id?: unknown } }).constructor?.id
  return typeof id === 'string' ? id : null
}

function isOverlayUtil(value: unknown): value is CanvasOverlayUtil {
  return Boolean(value && typeof (value as CanvasOverlayUtil).isActive === 'function' && typeof (value as CanvasOverlayUtil).render === 'function')
}
