import type { BrowserWindow } from 'electron'

type ShadowWindow = Pick<
  BrowserWindow,
  'hasShadow' | 'hide' | 'invalidateShadow' | 'isFocused' | 'isVisible' | 'setHasShadow' | 'show' | 'showInactive'
>

export function setWindowShadow(platform: NodeJS.Platform, win: ShadowWindow, shadow: boolean): void {
  if (platform !== 'darwin' || win.hasShadow() === shadow) return
  const restore = !shadow && win.isVisible()
  const focused = restore && win.isFocused()
  if (restore) win.hide()
  win.setHasShadow(shadow)
  win.invalidateShadow()
  if (focused) win.show()
  else if (restore) win.showInactive()
}
