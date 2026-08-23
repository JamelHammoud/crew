interface LaunchWindow {
  once(event: 'ready-to-show', listener: () => void): unknown
  isDestroyed(): boolean
  show(): void
  focus(): void
}

export function showWhenReady(win: LaunchWindow): void {
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    win.show()
    win.focus()
  })
}
