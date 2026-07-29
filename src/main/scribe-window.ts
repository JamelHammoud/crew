import { BrowserWindow, screen } from 'electron'
import type { ScribeSettings } from '../shared/scribe'
import type { PanelPage } from './tray-panel'
import { createScribeOptions } from './window-options'

// The pill, and the window it stands in. Frameless, transparent, above
// everything, and never focused: whatever you were typing in has to keep the
// caret, or a dictation would land nowhere.

const WIDTH = 216
const HEIGHT = 56
const MAX_HEIGHT = 140
// How far off the bottom of the screen it sits. Low enough to be out of the way
// and high enough to clear a dock.
const LIFT = 96

export class ScribeWindow {
  private win: BrowserWindow | null = null
  private settings: ScribeSettings | null = null

  constructor(private readonly page: PanelPage) {}

  owns(win: BrowserWindow): boolean {
    return this.win === win
  }

  // Built and loaded before anyone presses the key, the way the tray panel is,
  // and for a bigger reason: this window holds whisper, and a model that has to
  // be fetched at the moment somebody starts talking is a first dictation that
  // arrives a minute late.
  warm(): void {
    this.window()
  }

  show(): void {
    const win = this.window()
    this.place()
    // Never `show`, which would take the focus off the app being dictated into
    // and land the paste in the wrong place, or nowhere at all.
    win.showInactive()
  }

  hide(): void {
    this.win?.hide()
  }

  get showing(): boolean {
    return this.win?.isVisible() ?? false
  }

  send(channel: string, ...args: unknown[]): void {
    const win = this.win
    if (!win || win.webContents.isDestroyed()) return
    win.webContents.send(channel, ...args)
  }

  apply(settings: ScribeSettings): void {
    this.settings = settings
    this.send('scribe:settings', settings)
  }

  resize(height: number): void {
    const win = this.win
    if (!win) return
    const wanted = Math.round(Math.max(HEIGHT, Math.min(height, MAX_HEIGHT)))
    if (win.getBounds().height === wanted) return
    win.setBounds({ ...win.getBounds(), height: wanted })
    this.place()
  }

  close(): void {
    this.win?.destroy()
    this.win = null
  }

  // The screen the pointer is on rather than the primary one, because that is
  // the screen the app being typed into is almost certainly on.
  private place(): void {
    const win = this.win
    if (!win) return
    const bounds = win.getBounds()
    const work = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
    win.setBounds({
      ...bounds,
      x: Math.round(work.x + work.width / 2 - bounds.width / 2),
      y: Math.round(work.y + work.height - bounds.height - LIFT)
    })
  }

  private window(): BrowserWindow {
    if (this.win) return this.win
    const win = new BrowserWindow(
      createScribeOptions(process.platform, this.page.preload, { width: WIDTH, height: HEIGHT })
    )
    // Above a full screen app and on whichever space is in front. Never this
    // call without `skipTransformProcessType`: it turns the app into an
    // accessory on macOS and the icon leaves the dock for good.
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true
    })
    win.excludedFromShownWindowsMenu = true
    win.on('closed', () => {
      this.win = null
    })
    win.webContents.once('did-finish-load', () => {
      if (this.settings) win.webContents.send('scribe:settings', this.settings)
    })
    if (this.page.devUrl) void win.loadURL(`${this.page.devUrl}#scribe`)
    else void win.loadFile(this.page.file, { hash: 'scribe' })
    this.win = win
    return win
  }
}
