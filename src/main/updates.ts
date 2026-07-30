import type { BrowserWindow } from 'electron'
import type { AppUpdater } from 'electron-updater'
import electronUpdater from 'electron-updater'
import { NO_UPDATE, nextUpdate, type UpdateState, type UpdateWord } from '../shared/update'

const AGAIN_MS = 60 * 60 * 1000

let made: AppUpdater | null = null
const autoUpdater = (): AppUpdater => (made ??= electronUpdater.autoUpdater)

export class Updates {
  private state: UpdateState = NO_UPDATE
  private timer: ReturnType<typeof setInterval> | null = null
  private live = false

  constructor(private readonly windows: () => BrowserWindow[]) {}

  // A run from source has no release behind it and no signature to check one
  // against, so the pill never stands there and nothing is ever fetched.
  start(packaged: boolean): void {
    if (this.live || !packaged) return
    this.live = true
    const up = autoUpdater()
    up.autoDownload = false
    // A download nobody restarted for is still put on at the next quit, so an
    // update asked for is never lost to closing the window.
    up.autoInstallOnAppQuit = true
    up.on('update-available', info => this.say({ word: 'found', version: info.version }))
    up.on('update-not-available', () => this.say({ word: 'nothing' }))
    up.on('download-progress', progress => this.say({ word: 'progress', percent: progress.percent }))
    up.on('update-downloaded', info => this.say({ word: 'ready', version: info.version }))
    up.on('error', () => this.say({ word: 'error' }))
    this.check()
    this.timer = setInterval(() => this.check(), AGAIN_MS)
  }

  now(): UpdateState {
    return this.state
  }

  // The one press. What it does is read off where the update has got to rather
  // than from what the window believes, since a window that has been open all
  // day can be a stage behind.
  press(): void {
    if (!this.live) return
    if (this.state.stage === 'ready') {
      this.restart()
      return
    }
    if (this.state.stage !== 'found' && this.state.stage !== 'failed') return
    this.say({ word: 'getting' })
    void autoUpdater()
      .downloadUpdate()
      .catch(() => this.say({ word: 'error' }))
  }

  tell(win: BrowserWindow): void {
    if (!win.webContents.isDestroyed()) win.webContents.send('update:state', this.state)
  }

  close(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private check(): void {
    if (this.state.stage !== 'none') return
    void autoUpdater()
      .checkForUpdates()
      .catch(() => this.say({ word: 'error' }))
  }

  private say(said: UpdateWord): void {
    const next = nextUpdate(this.state, said)
    if (next === this.state) return
    this.state = next
    for (const win of this.windows()) this.tell(win)
    if (next.stage !== 'ready') return
    // Nothing left to look for once it has landed. The press was for the whole
    // update rather than for the half of it that fetches, so the rest of it
    // happens without a second press.
    this.close()
    this.restart()
  }

  // Silent and running again on the other side, because the press was somebody
  // asking for the new Crew rather than for an installer to look at. It is left
  // a beat so the window it was pressed in has painted the press before the app
  // goes, and so whatever quitting puts down is put down.
  private restart(): void {
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
  }
}
