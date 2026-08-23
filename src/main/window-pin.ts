export type PinnableWindow = {
  isAlwaysOnTop(): boolean
  isFullScreen(): boolean
  isMaximized(): boolean
  setAlwaysOnTop(pinned: boolean): void
}

export function windowShapeOf(win: PinnableWindow): { square: boolean; full: boolean; pinned: boolean } {
  const full = win.isFullScreen()
  return {
    square: full || win.isMaximized(),
    full,
    pinned: win.isAlwaysOnTop()
  }
}

export function pinWindow(win: PinnableWindow, pinned: boolean): boolean {
  win.setAlwaysOnTop(pinned)
  return win.isAlwaysOnTop()
}
