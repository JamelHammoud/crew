import { powerSaveBlocker } from 'electron'
import { AWAKE_HOLD, Awake } from '../shared/awake'

// The thin half of keeping the machine up. The rule is in shared, where a suite
// drives it without electron anywhere near it, and this is the hold itself.
export class KeepAwake {
  private asking = new Awake()
  private hold: number | null = null

  wants(id: number, on: boolean): void {
    this.answer(this.asking.wants(id, on))
  }

  forget(id: number): void {
    this.answer(this.asking.forget(id))
  }

  get on(): boolean {
    return this.asking.on
  }

  private answer(next: boolean | null): void {
    if (next === null) return
    if (next) {
      this.hold = powerSaveBlocker.start(AWAKE_HOLD)
      return
    }
    if (this.hold !== null && powerSaveBlocker.isStarted(this.hold)) powerSaveBlocker.stop(this.hold)
    this.hold = null
  }
}
