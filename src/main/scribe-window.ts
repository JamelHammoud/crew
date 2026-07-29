import fs from 'node:fs'
import { BrowserWindow, screen } from 'electron'
import { PILL_ROOM, type ScribeSettings } from '../shared/scribe'
import {
  fits,
  grown,
  hold,
  middle,
  PILL_LARGEST,
  restSpot,
  spotFrom,
  type Size,
  type Spot
} from './scribe-spot'
import type { PanelPage } from './tray-panel'
import { createScribeOptions } from './window-options'

// The pill, and the window it stands in. Frameless, transparent, above
// everything, and never focused: whatever you were typing in has to keep the
// caret, or a dictation would land nowhere.
//
// The window is the pill plus PILL_ROOM on every side, so its shadow has
// somewhere to land. Everything below is that window rather than the pill, which
// is why the room is added back to the screen a spot is held inside.
//
// It stands there the whole time dictation is on rather than arriving with a
// dictation, so it is only ever as big as the pill really is. Electron does not
// pass a click through a transparent window on either platform, so every pixel
// of window past the pill is a click of somebody else's that goes nowhere, and a
// window that is up all day may not hold any.

const SMALLEST = { width: PILL_REST + PILL_ROOM * 2, height: PILL_REST + PILL_ROOM * 2 }
const LARGEST = { width: PILL_WIDTH + PILL_ROOM * 2, height: PILL_MAX + PILL_ROOM * 2 }

const within = (size: Size): Size => ({
  width: Math.round(Math.max(SMALLEST.width, Math.min(size.width, LARGEST.width))),
  height: Math.round(Math.max(SMALLEST.height, Math.min(size.height, LARGEST.height)))
})

export class ScribeWindow {
  private win: BrowserWindow | null = null
  private settings: ScribeSettings | null = null
  private file: string | null = null
  // Where it was put, which is a decision somebody made once and should not
  // have to make again. Null until they make it, and the bottom middle of the
  // screen until then.
  private spot: Spot | null = null
  // Where the pill stood when it was taken hold of. Every move is measured
  // from here rather than from where it has got to, so a drag that runs into
  // the edge of a screen comes back off it as the pointer does.
  private held: Spot | null = null

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

  remember(file: string): void {
    this.file = file
    try {
      this.spot = spotFrom(JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch {
      this.spot = null
    }
  }

  // Placed only on the way up. Placing a pill nobody has moved reads the
  // pointer, so a window that placed itself every time it was shown would walk
  // to whichever screen the pointer happened to be on, and one that is up all
  // day is shown once.
  show(): void {
    const win = this.window()
    if (win.isVisible()) return
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

  // Dictation being on is the whole of whether the pill is on screen. It says
  // Scribe is here and where the words will be read, which is what it is for the
  // rest of the time, and one decision covers turning it on, a dictation ending,
  // and one being thrown away.
  apply(settings: ScribeSettings): void {
    this.settings = settings
    this.send('scribe:settings', settings)
    this.rest()
  }

  rest(): void {
    if (this.settings?.on) this.show()
    else this.hide()
  }

  // A pill that has grown keeps its bottom edge and its middle, and is never
  // placed again. Placing reads the pointer, and the pointer has moved on by the
  // time the renderer has measured itself, which is what made the pill land
  // somewhere different every time it was shown.
  //
  // Growing is not moving, so it never writes a spot down. Only a drag does, or
  // a pill that grew once on one screen would be pinned to it from then on by
  // nobody's decision.
  resize(size: Size): void {
    const win = this.win
    if (!win) return
    const wanted = within(size)
    const box = win.getBounds()
    if (box.width === wanted.width && box.height === wanted.height) return
    const spot = grown(box, wanted, this.workNear(middle({ ...box, ...wanted })))
    win.setBounds({ ...spot, ...wanted })
  }

  grab(): void {
    const box = this.win?.getBounds()
    this.held = box ? { x: box.x, y: box.y } : null
  }

  // Dragged by however far the pointer has travelled since it took hold, and
  // held inside whichever screen the pill is now mostly over, so it can be
  // moved to another monitor and cannot be pushed off the edge of one.
  drag(by: Spot, settled: boolean): void {
    const win = this.win
    const from = this.held
    if (!win || !from) return
    const box = win.getBounds()
    const wanted = { x: from.x + by.x, y: from.y + by.y }
    const spot = hold(wanted, box, this.workNear(middle({ ...box, ...wanted })))
    win.setBounds({ ...box, ...spot })
    this.spot = spot
    if (!settled) return
    this.held = null
    this.write(spot)
  }

  close(): void {
    this.win?.destroy()
    this.win = null
  }

  private write(spot: Spot): void {
    if (!this.file) return
    try {
      fs.writeFileSync(this.file, JSON.stringify(spot))
    } catch {}
  }

  // The screen a spot is held inside, grown by the room around the pill. Every
  // rule in `scribe-spot` is about where the pill may stand, and what the window
  // carries past it is empty air: held to the real work area instead, the pill
  // would rest a whole shadow's width in from every edge and the gap it keeps
  // off the bottom of the screen would be the one nobody chose.
  private workNear(point: Spot): Electron.Rectangle {
    const work = screen.getDisplayNearestPoint(point).workArea
    return {
      x: work.x - PILL_ROOM,
      y: work.y - PILL_ROOM,
      width: work.width + PILL_ROOM * 2,
      height: work.height + PILL_ROOM * 2
    }
  }

  // Where it was left, if it was ever moved. Otherwise the bottom middle of the
  // screen the pointer is on, which is the screen the app being typed into is
  // almost certainly on.
  private place(): void {
    const win = this.win
    if (!win) return
    const box = win.getBounds()
    const spot = this.spot
      ? hold(this.spot, box, this.workNear(middle({ ...box, ...this.spot })))
      : restSpot(this.workNear(screen.getCursorScreenPoint()), box)
    win.setBounds({ ...box, ...spot })
  }

  private window(): BrowserWindow {
    if (this.win) return this.win
    const win = new BrowserWindow(
      createScribeOptions(process.platform, this.page.preload, LARGEST)
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
