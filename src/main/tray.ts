import { Menu, nativeImage, nativeTheme, Tray, type BrowserWindow, type NativeImage } from 'electron'
import { badgeText, emptyPresence, presenceTooltip, type PresenceSnapshot } from '../shared/presence'
import { TrayPanel, type PanelPage } from './tray-panel'
import { TRAY_HEIGHT, TRAY_ICON, TRAY_WIDTH } from './tray-png'

const isMac = process.platform === 'darwin'

// The mark itself, as a template image: macOS reads the alpha and tints it to
// whatever the menu bar is wearing, light or dark, and inverts it while the
// panel is open.
function markIcon(): NativeImage {
  const image = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON, 'base64'), {
    width: TRAY_WIDTH,
    height: TRAY_HEIGHT,
    scaleFactor: 2
  })
  image.setTemplateImage(true)
  return image
}

// Everywhere else the taskbar has no template images, so the dot is drawn in
// memory and follows the system theme: light on a dark taskbar, dark on a
// light one.
function dotIcon(): NativeImage {
  const size = 32
  const shade = nativeTheme.shouldUseDarkColors ? 255 : 0
  const center = (size - 1) / 2
  const radius = size * 0.34
  const buffer = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x - center, y - center)))
      const i = (y * size + x) * 4
      buffer[i] = shade
      buffer[i + 1] = shade
      buffer[i + 2] = shade
      buffer[i + 3] = Math.round(alpha * 255)
    }
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: 2 })
}

export class CrewTray {
  private tray: Tray | null = null
  private panel: TrayPanel
  private state: PresenceSnapshot = emptyPresence()

  constructor(private opts: { page: PanelPage; openWindow: () => void; quit: () => void }) {
    this.panel = new TrayPanel(opts.page)
  }

  install(): void {
    const tray = new Tray(isMac ? markIcon() : dotIcon())
    this.tray = tray
    if (isMac) {
      // No context menu is set: one would open on a left click as well, and
      // the left click belongs to the panel.
      tray.on('click', () => this.panel.toggle(tray.getBounds()))
      tray.on('right-click', () => tray.popUpContextMenu(this.menu()))
    } else {
      tray.on('click', this.opts.openWindow)
      nativeTheme.on('updated', () => this.tray?.setImage(dotIcon()))
    }
    this.refresh()
  }

  update(patch: Partial<PresenceSnapshot>): void {
    this.state = { ...this.state, ...patch }
    this.refresh()
  }

  owns(win: BrowserWindow): boolean {
    return this.panel.owns(win)
  }

  warm(): void {
    if (isMac) this.panel.warm()
  }

  resizePanel(height: number): void {
    this.panel.resize(height)
  }

  theme(theme: 'dark' | 'light'): void {
    this.panel.theme(theme)
  }

  hidePanel(): void {
    this.panel.hide()
  }

  balloon(title: string, content: string): void {
    this.tray?.displayBalloon({ title, content })
  }

  close(): void {
    this.panel.close()
    this.tray?.destroy()
    this.tray = null
  }

  private refresh(): void {
    const tray = this.tray
    if (!tray) return
    tray.setToolTip(presenceTooltip(this.state))
    // The count rides beside the mark rather than on it: a menu bar item is
    // one line tall, and a badge drawn over twelve pixels of artwork is a
    // smudge.
    if (isMac) tray.setTitle(badgeText(this.state.waiting), { fontType: 'monospacedDigit' })
    else tray.setContextMenu(this.menu())
    this.panel.update(this.state)
  }

  private menu(): Menu {
    return Menu.buildFromTemplate([
      { label: 'Open Crew', click: this.opts.openWindow },
      { label: 'Quit Crew', click: this.opts.quit }
    ])
  }
}
