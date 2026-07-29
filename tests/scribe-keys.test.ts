import { describe, expect, it } from 'vitest'
import {
  ARM_MS,
  cleanSettings,
  defaultKey,
  defaultSettings,
  fallbackCombo,
  keyLabel,
  scribeKeys,
  TAP_MS,
  WORD_LIMIT
} from '../src/shared/scribe'
import { ScribeLatch, type LatchWord } from '../src/shared/scribeLatch'
import type { ScribePress } from '../src/shared/scribe'

// The key, driven by hand. Nothing here touches a keyboard or a clock of its
// own, which is the whole point of the rules being numbers.

class Keyboard {
  private latch: ScribeLatch
  private at = 0
  readonly said: LatchWord[] = []

  constructor(press: ScribePress) {
    this.latch = new ScribeLatch(press)
  }

  // The arming delay is a timer in the real thing, so waiting past it here is
  // the same as that timer coming round.
  wait(ms: number): this {
    const to = this.at + ms
    if (this.at < to) {
      this.at = to
      this.say(this.latch.tick(this.at))
    }
    return this
  }

  down(): this {
    this.say(this.latch.keyDown(this.at))
    return this
  }

  up(): this {
    this.say(this.latch.keyUp(this.at))
    return this
  }

  other(): this {
    this.say(this.latch.other())
    return this
  }

  combo(): this {
    this.say(this.latch.toggled())
    return this
  }

  stopped(): this {
    this.latch.stopped()
    return this
  }

  get running(): boolean {
    return this.latch.running
  }

  private say(word: LatchWord): void {
    if (word !== 'nothing') this.said.push(word)
  }
}

const HELD = ARM_MS + 40
const LONG = TAP_MS + 200

describe('the key a dictation is held on', () => {
  it('does not arm until it has been held alone', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(ARM_MS - 20)
    expect(keys.said).toEqual([])
    keys.wait(40)
    expect(keys.said).toEqual(['arm'])
  })

  it('lets a shortcut through untouched and never opens the microphone', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(40).other().wait(400).up()
    expect(keys.said).toEqual([])
    expect(keys.running).toBe(false)
  })

  it('drops a take the moment another key joins it', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(HELD)
    expect(keys.said).toEqual(['arm'])
    keys.other()
    expect(keys.said).toEqual(['arm', 'cancel'])
    keys.up()
    expect(keys.said).toEqual(['arm', 'cancel'])
    expect(keys.running).toBe(false)
  })

  it('ends on the release when it was really held', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(HELD).wait(LONG).up()
    expect(keys.said).toEqual(['arm', 'finish'])
    expect(keys.running).toBe(false)
  })

  it('stays on when it was tapped, and the next press is what ends it', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(HELD).up()
    expect(keys.said).toEqual(['arm'])
    expect(keys.running).toBe(true)
    keys.wait(3000).down()
    expect(keys.said).toEqual(['arm', 'finish'])
    keys.up()
    expect(keys.said).toEqual(['arm', 'finish'])
    expect(keys.running).toBe(false)
  })

  // A tap quick enough never to have armed is still a tap. Doing nothing with
  // one reads as a key that only works if you are slow about it.
  it('latches on a tap too quick to have armed', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(60).up()
    expect(keys.said).toEqual(['arm'])
    expect(keys.running).toBe(true)
  })

  it('holds and nothing else when it is set to hold', () => {
    const keys = new Keyboard('hold')
    keys.down().wait(60).up()
    expect(keys.said).toEqual([])
    keys.down().wait(HELD).up()
    expect(keys.said).toEqual(['arm', 'finish'])
  })

  it('turns over on each press when it is set to toggle', () => {
    const keys = new Keyboard('toggle')
    keys.down().wait(HELD)
    expect(keys.said).toEqual([])
    keys.up()
    expect(keys.said).toEqual(['arm'])
    keys.wait(2000).down()
    expect(keys.said).toEqual(['arm', 'finish'])
    keys.up()
    expect(keys.said).toEqual(['arm', 'finish'])
    expect(keys.running).toBe(false)
  })

  it('turns over on the combination whatever the key is set to', () => {
    for (const press of ['hold', 'toggle', 'latch'] as const) {
      const keys = new Keyboard(press)
      keys.combo()
      expect(keys.said).toEqual(['arm'])
      keys.combo()
      expect(keys.said).toEqual(['arm', 'finish'])
    }
  })

  // The check on the pill, the X, a failure, or the cap on how long one may run.
  it('takes a take ending some other way and does not end it twice', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(HELD).up().stopped()
    expect(keys.running).toBe(false)
    keys.wait(1000).down().wait(HELD)
    expect(keys.said).toEqual(['arm', 'arm'])
  })

  it('does not end a take twice when the key was still down', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(HELD)
    keys.stopped()
    keys.wait(LONG).up()
    expect(keys.said).toEqual(['arm'])
  })

  it('says nothing to a key repeating while it is held', () => {
    const keys = new Keyboard('latch')
    keys.down().wait(HELD).down().down()
    expect(keys.said).toEqual(['arm'])
  })
})

describe('what a machine is offered', () => {
  it('never offers Fn, because macOS never hands it over', () => {
    expect(scribeKeys('darwin')).not.toContain('fn')
    expect(defaultKey('darwin')).toBe('right-option')
    expect(defaultKey('win32')).toBe('right-ctrl')
  })

  it('names the same key the way each platform names it', () => {
    expect(keyLabel('right-option', 'darwin')).toBe('Right Option')
    expect(keyLabel('right-option', 'win32')).toBe('Right Alt')
    expect(keyLabel('meta', 'darwin')).toBe('Command')
    expect(keyLabel('meta', 'win32')).toBe('Windows')
  })

  it('has a combination that does not go through the hook', () => {
    expect(fallbackCombo('darwin')).toBe('Control+Command+Space')
    expect(fallbackCombo('win32')).toBe('Control+Alt+Space')
  })
})

describe('what arrives is only as good as what checks it', () => {
  it('falls back to this machine for anything it does not recognise', () => {
    const clean = cleanSettings({ key: 'fn', press: 'sideways', finish: 7 }, 'darwin')
    expect(clean.key).toBe('right-option')
    expect(clean.press).toBe('latch')
    expect(clean.finish).toBe('paste')
  })

  it('takes nothing at all and hands back what this machine would use', () => {
    expect(cleanSettings(null, 'win32')).toEqual(defaultSettings('win32'))
    expect(cleanSettings('nonsense', 'win32')).toEqual(defaultSettings('win32'))
  })

  it('keeps a dictionary and throws out the rows that say nothing', () => {
    const clean = cleanSettings(
      {
        words: [
          { from: 'clod', to: 'Claude' },
          { from: '  ', to: 'nothing' },
          { from: 'clod', to: 'twice' },
          { from: 'redis' },
          'not a row'
        ]
      },
      'darwin'
    )
    expect(clean.words).toEqual([{ from: 'clod', to: 'Claude' }])
  })

  it('will not take a dictionary longer than it can hold', () => {
    const words = Array.from({ length: WORD_LIMIT + 40 }, (_, at) => ({
      from: `word${at}`,
      to: `Word${at}`
    }))
    expect(cleanSettings({ words }, 'darwin').words).toHaveLength(WORD_LIMIT)
  })
})
