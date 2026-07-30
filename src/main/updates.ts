import { appendFileSync, mkdirSync, statSync, truncateSync } from 'node:fs'
import { dirname } from 'node:path'
import type { BrowserWindow } from 'electron'
import type { AppUpdater } from 'electron-updater'
import electronUpdater from 'electron-updater'
import {
  mayInstall,
  nextUpdate,
  worthChecking,
  NO_UPDATE,
  type UpdateState,
  type UpdateWord
} from '../shared/update'

const AGAIN_MS = 60 * 60 * 1000
const GONE_MS = 20 * 1000
const LOG_CAP = 512 * 1024

// The one export of this package that is a getter on its exports rather than a
// plain assignment, so the lexer node reads a CommonJS module's names with
// cannot see it. Reading it is what builds the platform updater, so it is read
// once and only for a run that has a release behind it.
let made: AppUpdater | null = null
const autoUpdater = (): AppUpdater => (made ??= electronUpdater.autoUpdater)

export interface UpdatesHost {
  windows: () => BrowserWindow[]
  // How many other Crews are live on this machine. The installer replaces the
  // whole app and on Windows force-kills every one it finds, so an install waits
  // for them rather than taking their work down.
  others: () => number
  // Whatever quitting puts down, put down before the app is replaced under it.
  // It is the same one main quits through, so nothing is shut down twice.
  settle: () => Promise<void>
  log: string
}

export class Updates {
  private state: UpdateState = NO_UPDATE
  private timer: ReturnType<typeof setInterval> | null = null
  private gone: ReturnType<typeof setTimeout> | null = null
  private live = false
  private landed = false
  private going = false

  constructor(private readonly host: UpdatesHost) {}

  // A run from source has no release behind it and no signature to check one
  // against, so the pill never stands there and nothing is ever fetched.
  start(packaged: boolean): void {
    if (this.live || !packaged) return
    this.live = true
    const up = autoUpdater()
    up.logger = this.logger()
    up.autoDownload = false
    // Crew decides when the app may be replaced, so nothing installs itself on
    // the way out. Nothing is lost by that: the download stays on the disk, so
    // the press after a restart lands straight on ready.
    up.autoInstallOnAppQuit = false
    up.on('update-available', info => this.say({ word: 'found', version: info.version }))
    up.on('update-not-available', () => this.say({ word: 'nothing' }))
    up.on('download-progress', progress =>
      this.say({ word: 'progress', percent: progress.percent })
    )
    up.on('update-downloaded', info => {
      this.landed = true
      this.say({ word: 'ready', version: info.version })
    })
    up.on('error', () => this.say({ word: 'error' }))
    this.check()
    this.timer = setInterval(() => this.check(), AGAIN_MS)
  }

  now(): UpdateState {
    return this.state
  }

  // The one press. What it does is read off what has really arrived rather than
  // off the stage alone, so pressing again after the install was held tries the
  // install rather than fetching a file that is already on the disk.
  press(): void {
    if (!this.live || this.going) return
    if (this.landed) {
      void this.install()
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
    if (this.gone) clearTimeout(this.gone)
    this.timer = null
    this.gone = null
  }

  private check(): void {
    if (!worthChecking(this.state.stage)) return
    void autoUpdater()
      .checkForUpdates()
      .catch(() => this.say({ word: 'error' }))
  }

  private say(said: UpdateWord): void {
    const next = nextUpdate(this.state, said)
    if (next === this.state) return
    this.state = next
    for (const win of this.windows()) this.tell(win)
    if (next.stage === 'ready') void this.install()
  }

  private windows(): BrowserWindow[] {
    return this.host.windows()
  }

  // Silent and running again on the other side, because the press was somebody
  // asking for the new Crew rather than for an installer to look at.
  private async install(): Promise<void> {
    if (this.going || this.state.stage !== 'ready') return
    if (!mayInstall(this.host.others())) {
      this.say({ word: 'stuck', why: 'others' })
      return
    }
    this.going = true
    await this.host.settle().catch(() => {})
    // An install that will not happen says nothing for itself: Squirrel refuses
    // an app it cannot verify and the silent installer takes the cancel default,
    // and either way the app is still standing here a moment later.
    this.gone = setTimeout(() => {
      this.going = false
      this.say({ word: 'stuck', why: 'install' })
    }, GONE_MS)
    try {
      autoUpdater().quitAndInstall(true, true)
    } catch {
      if (this.gone) clearTimeout(this.gone)
      this.gone = null
      this.going = false
      this.say({ word: 'stuck', why: 'install' })
    }
  }

  // Nothing a packaged app logs to a console is ever read, so a failure out
  // there leaves a trace on the disk instead.
  private logger(): { info: Log; warn: Log; error: Log; debug: Log } {
    const write = (level: string): Log => {
      return message => {
        try {
          mkdirSync(dirname(this.host.log), { recursive: true })
          if ((statSync(this.host.log, { throwIfNoEntry: false })?.size ?? 0) > LOG_CAP) {
            truncateSync(this.host.log, 0)
          }
          appendFileSync(this.host.log, `${new Date().toISOString()} ${level} ${message}\n`)
        } catch {
          // A log that cannot be written is not worth taking an update down for.
        }
      }
    }
    return { info: write('info'), warn: write('warn'), error: write('error'), debug: write('debug') }
  }
}

type Log = (message: unknown) => void
