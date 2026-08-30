import { appendFileSync, mkdirSync, statSync, truncateSync } from 'node:fs'
import { dirname } from 'node:path'
import type { BrowserWindow } from 'electron'
import type { AppUpdater } from 'electron-updater'
import electronUpdater from 'electron-updater'
import { mayInstall, nextUpdate, worthChecking, NO_UPDATE, type UpdateState, type UpdateWord } from '../shared/update'

const AGAIN_MS = 60 * 60 * 1000
const GONE_MS = 60 * 1000
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
  prepareQuit: () => void
  cancelQuit: () => void
  log: string
}

export class Updates {
  private state: UpdateState = NO_UPDATE
  private timer: ReturnType<typeof setInterval> | null = null
  private gone: ReturnType<typeof setTimeout> | null = null
  private live = false
  private landed = false
  private going = false

  constructor(
    private readonly host: UpdatesHost,
    private readonly updater: () => AppUpdater = autoUpdater
  ) {}

  // A run from source has no release behind it and no signature to check one
  // against, so the pill never stands there and nothing is ever fetched.
  start(packaged: boolean): void {
    if (this.live || !packaged) return
    this.live = true
    const up = this.updater()
    up.logger = this.logger()
    up.autoDownload = true
    // Crew decides when the app may be replaced, so nothing installs itself on
    // the way out. Nothing is lost by that: the download stays on the disk, so
    // the press after a restart lands straight on ready.
    up.autoInstallOnAppQuit = false
    up.on('update-available', info => {
      if (this.state.stage === 'ready' && this.state.version === info.version) return
      this.landed = false
      this.say({ word: 'found', version: info.version })
      this.say({ word: 'getting' })
    })
    up.on('update-not-available', () => this.say({ word: 'nothing' }))
    up.on('download-progress', progress => this.say({ word: 'progress', percent: progress.percent }))
    up.on('update-downloaded', info => {
      this.landed = true
      this.say({ word: 'ready', version: info.version })
    })
    // Squirrel refuses an app it cannot verify, and it says so here rather than
    // on the way out, so an install already asked for is answered at once rather
    // than left to the wait that catches the silent ways of failing.
    up.on('error', () => {
      if (this.going) this.gaveUp()
      else this.say({ word: 'error' })
    })
    this.check()
    this.timer = setInterval(() => this.check(), AGAIN_MS)
  }

  now(): UpdateState {
    return this.state
  }

  checkNow(): void {
    if (this.live) this.check()
  }

  press(): void {
    if (!this.live || this.going || !this.landed) return
    void this.install()
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
    void this.updater()
      .checkForUpdates()
      .then(result => void result?.downloadPromise?.catch(() => {}))
      .catch(() => this.say({ word: 'error' }))
  }

  private say(said: UpdateWord): void {
    const next = nextUpdate(this.state, said)
    if (next === this.state) return
    this.state = next
    for (const win of this.host.windows()) this.tell(win)
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
    // An install that will not happen says nothing for itself. Squirrel does
    // nothing at all for an app it never staged, and the silent installer is
    // spawned detached with its exit code never read, so what says it did not
    // happen is the app still standing here a while later. The wait is armed
    // before the shutdown rather than after it, or a push that never comes back
    // leaves the pill offering a restart that is never coming.
    this.gone = setTimeout(() => this.gaveUp(), GONE_MS)
    await this.host.settle().catch(() => {})
    if (!this.going) return
    try {
      this.host.prepareQuit()
      this.updater().quitAndInstall(true, true)
    } catch {
      this.gaveUp()
    }
  }

  private gaveUp(): void {
    if (!this.going) return
    if (this.gone) clearTimeout(this.gone)
    this.gone = null
    this.going = false
    this.host.cancelQuit()
    this.say({ word: 'stuck', why: 'install' })
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
