import { globalShortcut, systemPreferences } from 'electron'
import { createRequire } from 'node:module'
import { ARM_MS, fallbackCombo, type ScribeKey, type ScribeSettings } from '../shared/scribe'
import { ScribeLatch } from '../shared/scribeLatch'

// The hotkey. A bare modifier is the only key worth dictating on and it is the
// one kind electron cannot register, because `globalShortcut` needs a real key
// in the combination. So this listens below the window instead, through
// libuiohook, which is bound over N-API the way node-pty is and loads in
// electron without ever being rebuilt for it.

export interface ScribeKeysEars {
  onArm: () => void
  onFinish: () => void
  onCancel: () => void
}

interface KeyEvent {
  keycode: number
}

interface Hook {
  on(event: 'keydown' | 'keyup', listen: (event: KeyEvent) => void): void
  off(event: 'keydown' | 'keyup', listen: (event: KeyEvent) => void): void
  start(): void
  stop(): void
  keyTap(key: number, modifiers?: number[]): void
}

interface Uiohook {
  uIOhook: Hook
  UiohookKey: Record<string, number>
}

// Loaded the moment it is needed and never at the top of the file. A native
// module that will not load throws on the import itself, and an app that cannot
// start because dictation is unavailable is worse than dictation being
// unavailable.
let loaded: Uiohook | null | undefined

function uiohook(): Uiohook | null {
  if (loaded !== undefined) return loaded
  try {
    loaded = createRequire(import.meta.url)('uiohook-napi') as Uiohook
  } catch {
    loaded = null
  }
  return loaded
}

const CODES: Record<Exclude<ScribeKey, 'none'>, string[]> = {
  'right-option': ['AltRight'],
  'right-ctrl': ['CtrlRight'],
  // Either hand, because nobody thinks of the two control keys as two keys.
  ctrl: ['Ctrl', 'CtrlRight'],
  meta: ['Meta', 'MetaRight']
}

function codesFor(key: ScribeKey, keys: Record<string, number>): number[] {
  if (key === 'none') return []
  return CODES[key].map(name => keys[name]).filter(code => typeof code === 'number')
}

export interface ScribeKeysState {
  // Whether the low level hook is really running. On Windows it can go quiet
  // after the microphone opens, and on macOS it needs Accessibility, so this is
  // said on the settings page rather than left to be guessed from a key that
  // does nothing.
  hooked: boolean
  trusted: boolean
}

export class ScribeKeys {
  private latch = new ScribeLatch('latch')
  private codes: number[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private started = false
  private combo: string | null = null
  private settings: ScribeSettings | null = null
  private down: ((event: KeyEvent) => void) | null = null
  private up: ((event: KeyEvent) => void) | null = null

  constructor(private readonly ears: ScribeKeysEars) {}

  apply(settings: ScribeSettings): void {
    this.settings = settings
    this.latch.mode(settings.press)
    if (!settings.on) {
      this.stopAll()
      return
    }
    const hook = uiohook()
    this.codes = hook ? codesFor(settings.key, hook.UiohookKey) : []
    this.listen(hook)
    this.register()
  }

  state(): ScribeKeysState {
    return { hooked: this.started, trusted: this.trusted() }
  }

  // Whatever ended the take, the key has to be told, or the next press reads as
  // the end of a dictation that is already over.
  stopped(): void {
    clearTimeout(this.timer)
    this.latch.stopped()
  }

  close(): void {
    this.stopAll()
    loaded?.uIOhook.stop()
  }

  private trusted(): boolean {
    if (process.platform !== 'darwin') return true
    return systemPreferences.isTrustedAccessibilityClient(false)
  }

  private listen(hook: Uiohook | null): void {
    if (!hook) return
    if (!this.started) {
      // Both the hook and the paste want Accessibility, so it is asked for once,
      // the first time somebody arms Scribe, rather than at launch for a feature
      // they may never turn on.
      if (process.platform === 'darwin') systemPreferences.isTrustedAccessibilityClient(true)
      try {
        hook.uIOhook.start()
        this.started = true
      } catch {
        this.started = false
        return
      }
    }
    if (this.down) return
    this.down = event => this.pressed(event.keycode)
    this.up = event => this.released(event.keycode)
    hook.uIOhook.on('keydown', this.down)
    hook.uIOhook.on('keyup', this.up)
  }

  private register(): void {
    const wanted = fallbackCombo(process.platform)
    if (this.combo === wanted) return
    this.unregister()
    try {
      if (globalShortcut.register(wanted, () => this.say(this.latch.toggled()))) this.combo = wanted
    } catch {
      this.combo = null
    }
  }

  private unregister(): void {
    if (!this.combo) return
    globalShortcut.unregister(this.combo)
    this.combo = null
  }

  private stopAll(): void {
    clearTimeout(this.timer)
    if (this.latch.running) this.ears.onCancel()
    this.latch.stopped()
    this.unregister()
    const hook = loaded
    if (hook && this.down && this.up) {
      hook.uIOhook.off('keydown', this.down)
      hook.uIOhook.off('keyup', this.up)
    }
    this.down = null
    this.up = null
  }

  private pressed(keycode: number): void {
    if (!this.codes.includes(keycode)) {
      this.say(this.latch.other())
      return
    }
    this.say(this.latch.keyDown(Date.now()))
    if (this.latch.running || !this.latch.holding) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.say(this.latch.tick(Date.now())), ARM_MS)
  }

  private released(keycode: number): void {
    if (!this.codes.includes(keycode)) return
    clearTimeout(this.timer)
    this.say(this.latch.keyUp(Date.now()))
  }

  private say(word: string): void {
    if (word === 'arm') this.ears.onArm()
    else if (word === 'finish') this.ears.onFinish()
    else if (word === 'cancel') this.ears.onCancel()
  }
}

// The paste keystroke, sent to whatever has focus. It goes through the same hook
// the key is read with, so there is one path on every platform rather than an
// osascript on one and a native call on the other.
export function tapPaste(): boolean {
  const hook = uiohook()
  if (!hook) return false
  const { uIOhook, UiohookKey } = hook
  const modifier = process.platform === 'darwin' ? UiohookKey.Meta : UiohookKey.Ctrl
  try {
    uIOhook.keyTap(UiohookKey.V, [modifier])
    return true
  } catch {
    return false
  }
}
