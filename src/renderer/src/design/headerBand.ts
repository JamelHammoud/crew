import type { DesignPanelsOpen } from '../components/designPanelsOpen'
import { HEADER_EDGE } from '../state/headerSlot'

export const LEFT_PANEL_W = 256
export const RIGHT_PANEL_W = 340
export const NAME_PAD = 14

export function bandColumns(panels: DesignPanelsOpen): { left: number; right: number } {
  return { left: panels.left ? LEFT_PANEL_W : 0, right: panels.right ? RIGHT_PANEL_W : 0 }
}

export function nameInset(panels: DesignPanelsOpen, room: number): number {
  return Math.max(0, bandColumns(panels).left + NAME_PAD - HEADER_EDGE - room)
}

export function toolsInset(panels: DesignPanelsOpen, room: number): number {
  return Math.max(0, bandColumns(panels).right - HEADER_EDGE - room)
}
