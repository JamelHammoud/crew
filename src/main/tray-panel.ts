import { BrowserWindow, screen, type Rectangle } from 'electron'
import { emptyPresence, type PresenceSnapshot } from '../shared/presence'
import { panelSpot } from './tray-position'

export interface PanelPage {
  preload: string
  devUrl: string | undefined
  file: string
}

export const PANEL_WIDTH = 272
const MIN_HEIGHT = 64
const MAX_HEIGHT = 520
// A click on the tray icon takes the focus off the panel before it arrives, so
// a panel that has only just closed is not reopened by the click that shut it.
const SETTLING = 250

export class TrayPanel {
  private win: BrowserWindow | null = null
  private snapshot: PresenceSnapshot = emptyPresence()
  private icon: Rectangle | null = null
  private wearing: 'dark' | 'light' = 'dark'
  private closedAt = 0

  constructor(private page: PanelPage) {}

  owns(win: BrowserWindow): boolean {
    return this.win === win
  }

  // Built and loaded before anyone asks for it, so the first click opens a
  // list rather than an empty card that fills in a moment later.
  warm(): void {
    this.window()
  }

  toggle(icon: Rectangle): void {
    if (this.win?.isVisible()) {
      this.hide()
      return
    }
    if (Date.now() - this.closedAt < SETTLING) return
    this.open(icon)
  }

  hide(): void {
    if (!this.win?.isVisible()) return
    this.closedAt = Date.now()
    this.win.hide()
  }

  update(snapshot: PresenceSnapshot): void {
    this.snapshot = snapshot
    if (this.win && !this.win.webContents.isLoading()) {
      this.win.webContents.send('presence:update', snapshot)
    }
  }

  theme(theme: 'dark' | 'light'): void {
    this.wearing = theme
    if (this.win && !this.win.webContents.isLoading()) {
      this.win.webContents.send('tray:theme', theme)
    }
  }

  resize(height: number): void {
    const win = this.win
    if (!win) return
    const wanted = Math.round(Math.max(MIN_HEIGHT, Math.min(height, MAX_HEIGHT)))
    if (win.getBounds().height === wanted) return
    win.setBounds({ ...win.getBounds(), height: wanted })
    this.place()
  }

  close(): void {
    this.win?.destroy()
    this.win = null
  }

  private open(icon: Rectangle): void {
    this.icon = icon
    const win = this.window()
    this.place()
    win.show()
    win.focus()
  }

  private place(): void {
    const win = this.win
    const icon = this.icon
    if (!win || !icon) return
    const bounds = win.getBounds()
    const work = screen.getDisplayNearestPoint({ x: icon.x, y: icon.y }).workArea
    const spot = panelSpot(icon, bounds, work)
    win.setBounds({ ...bounds, ...spot })
  }

  private window(): BrowserWindow {
    if (this.win) return this.win
    const win = new BrowserWindow({
      width: PANEL_WIDTH,
      height: MIN_HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      title: 'crew',
      webPreferences: {
        preload: this.page.preload,
        contextIsolation: true,
        sandbox: false
      }
    })
    // Above a full screen app and on whichever space is in front, the way the
    // menu bar itself is.
    win.setAlwaysOnTop(true, 'pop-up-menu')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.on('blur', () => this.hide())
    win.on('closed', () => {
      this.win = null
    })
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('tray:theme', this.wearing)
      win.webContents.send('presence:update', this.snapshot)
    })
    if (this.page.devUrl) win.loadURL(`${this.page.devUrl}#tray`)
    else win.loadFile(this.page.file, { hash: 'tray' })
    this.win = win
    return win
  }
}
