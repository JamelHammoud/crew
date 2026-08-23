import type { BrowserWindow } from 'electron'
import type { BrowserTab } from '../shared/browserTab'

type BrowserTabWindowOptions = {
  create(): BrowserWindow
  join(id: number, place: string): unknown
  load(win: BrowserWindow): void
}

export function openBrowserTabWindow(tab: BrowserTab, place: string | null, options: BrowserTabWindowOptions): boolean {
  if (!place) return false
  const win = options.create()
  if (!options.join(win.webContents.id, place)) {
    win.destroy()
    return false
  }
  win.webContents.once('did-finish-load', () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('browser:open-tab', tab)
  })
  options.load(win)
  return true
}
