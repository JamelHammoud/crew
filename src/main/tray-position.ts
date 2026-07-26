export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

const EDGE = 8
const GAP = 6

// The panel hangs from the middle of the tray icon and stays on the screen that
// icon is on, so one sitting hard against the right edge does not take the
// panel off with it. When it is taller than the space below, the top edge wins:
// a panel pushed up under the menu bar is easier to read than one hanging off
// the bottom of the screen.
export function panelSpot(icon: Box, panel: Size, work: Box): { x: number; y: number } {
  const wanted = Math.round(icon.x + icon.width / 2 - panel.width / 2)
  const right = work.x + work.width - panel.width - EDGE
  const bottom = work.y + work.height - panel.height - EDGE
  return {
    x: Math.max(work.x + EDGE, Math.min(wanted, right)),
    y: Math.max(work.y, Math.min(Math.round(icon.y + icon.height + GAP), bottom))
  }
}
