import { useValue } from '../signals'
import type { CanvasOverlayManager, CanvasOverlayUtil } from './types'

export const CANVAS_OVERLAY_TYPES = {
  selection: 'selection_foreground',
  brush: 'brush',
  snap: 'snap_indicator',
  handle: 'shape_handle'
} as const

export type CanvasOverlayHook = keyof typeof CANVAS_OVERLAY_TYPES

export function canvasOverlayIsActive(
  overlays: CanvasOverlayManager,
  type: CanvasOverlayHook | (string & {})
): boolean {
  const overlayType = type in CANVAS_OVERLAY_TYPES ? CANVAS_OVERLAY_TYPES[type as CanvasOverlayHook] : type
  try {
    return overlays.getOverlayUtil<CanvasOverlayUtil>(overlayType).isActive()
  } catch {
    return false
  }
}

export function useCanvasOverlayActive(
  overlays: CanvasOverlayManager | null,
  type: CanvasOverlayHook | (string & {})
): boolean {
  return useValue(
    `canvas ${type} overlay`,
    () => (overlays ? canvasOverlayIsActive(overlays, type) : false),
    [overlays, type]
  )
}

export const useSelectionOverlayActive = (overlays: CanvasOverlayManager | null) =>
  useCanvasOverlayActive(overlays, 'selection')

export const useBrushOverlayActive = (overlays: CanvasOverlayManager | null) =>
  useCanvasOverlayActive(overlays, 'brush')

export const useSnapOverlayActive = (overlays: CanvasOverlayManager | null) =>
  useCanvasOverlayActive(overlays, 'snap')

export const useHandleOverlayActive = (overlays: CanvasOverlayManager | null) =>
  useCanvasOverlayActive(overlays, 'handle')
