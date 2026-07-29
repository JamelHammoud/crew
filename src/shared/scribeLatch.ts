import { ARM_MS, TAP_MS, type ScribePress } from './scribe'

// What one key does over time. It is numbers and nothing else, the way the games
// are: no keyboard, no timer of its own, no electron. Whatever is really
// listening feeds it presses and the clock, and it says what should happen.
//
// Four rules make a bare modifier bearable, and each one is here because without
// it the key is unusable. It does not arm until it has been held alone, so
// reaching for a shortcut never raises the pill. Any other key drops the take
// and lets the shortcut through. A tap latches, so a hold is a hold and a tap is
// hands free, which is one rule rather than a mode to pick. And a press while it
// is latched is what ends it.

export type LatchWord = 'nothing' | 'arm' | 'finish' | 'cancel'

export class ScribeLatch {
  private down = false
  private downAt = 0
  private spoiled = false
  private armed = false
  private latched = false
  // The press has already done its work, so the release that follows does none.
  // Without it a toggle ends a take on the way down and opens another on the way
  // back up, which reads as a key that cannot be turned off.
  private spent = false

  constructor(private press: ScribePress) {}

  mode(press: ScribePress): void {
    this.press = press
  }

  get running(): boolean {
    return this.armed
  }

  get holding(): boolean {
    return this.down
  }

  keyDown(at: number): LatchWord {
    if (this.down) return 'nothing'
    this.down = true
    this.downAt = at
    this.spoiled = false
    this.spent = false
    if (this.armed && (this.latched || this.press === 'toggle')) {
      this.armed = false
      this.latched = false
      this.spent = true
      return 'finish'
    }
    return 'nothing'
  }

  // The arming delay, come round. Nothing arms on the way down, so a key that
  // turned out to be the front of a shortcut never opened a microphone.
  tick(at: number): LatchWord {
    if (!this.down || this.spoiled || this.spent || this.armed) return 'nothing'
    if (this.press === 'toggle') return 'nothing'
    if (at - this.downAt < ARM_MS) return 'nothing'
    this.armed = true
    this.latched = false
    return 'arm'
  }

  // Anything else pressed while the key is held. This is the whole of what makes
  // plain Control safe to dictate on.
  other(): LatchWord {
    if (!this.down || this.spoiled) return 'nothing'
    this.spoiled = true
    if (!this.armed) return 'nothing'
    this.armed = false
    this.latched = false
    return 'cancel'
  }

  keyUp(at: number): LatchWord {
    if (!this.down) return 'nothing'
    const held = at - this.downAt
    const spoiled = this.spoiled || this.spent
    this.down = false
    this.spoiled = false
    this.spent = false
    if (spoiled) return 'nothing'
    if (this.press === 'toggle') return this.open(true)
    if (this.press === 'hold') {
      if (!this.armed) return 'nothing'
      this.armed = false
      this.latched = false
      return 'finish'
    }
    // Let go of inside the tap window it stays on, however far in it was: a tap
    // quick enough never to have armed is still a tap, and doing nothing with it
    // reads as a key that only works if you are slow.
    if (!this.armed) return held < TAP_MS ? this.open(true) : 'nothing'
    if (this.latched) return 'nothing'
    if (held < TAP_MS) {
      this.latched = true
      return 'nothing'
    }
    this.armed = false
    return 'finish'
  }

  // The combination that is always live, which only ever gets a press. It is a
  // toggle whatever the key is set to, because a release is never coming.
  toggled(): LatchWord {
    if (this.armed) {
      this.armed = false
      this.latched = false
      this.spent = this.down
      return 'finish'
    }
    return this.open(this.down)
  }

  // The take ended some other way: the check on the pill, the X, a failure, or
  // the cap on how long one may run.
  stopped(): void {
    this.armed = false
    this.latched = false
    this.spent = this.down
  }

  private open(spend: boolean): LatchWord {
    this.armed = true
    this.latched = true
    this.spent = spend
    return 'arm'
  }
}
