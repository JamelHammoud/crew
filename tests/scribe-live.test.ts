import { describe, expect, it } from 'vitest'
import { ownKey, OWN_MS } from '../src/shared/scribe'
import { ScribeFlow } from '../src/shared/scribeLive'
import { TIDY_RULES, type ScribeChunk } from '../src/shared/scribeTidy'

// A dictation written as it is said, driven by hand. Nothing here opens a
// microphone or reads a model: what matters about it is which words go out, in
// what order, and that none of them go twice.

const said = (text: string, start: number, end: number): ScribeChunk[] => [{ text, start, end }]

describe('writing a dictation as it is said', () => {
  it('writes each stretch the moment it has been read', () => {
    const flow = new ScribeFlow()
    expect(flow.next(said('open the file', 0, 1.4), TIDY_RULES)).toBe('Open the file.')
    expect(flow.next(said('then run the tests', 2.6, 4), TIDY_RULES)).toBe(' Then run the tests.')
  })

  // The one thing the first stretch must not carry. Where the caret is standing
  // belongs to whoever put it there.
  it('leaves the first stretch flush against whatever it lands on', () => {
    const flow = new ScribeFlow()
    expect(flow.next(said('hello', 0, 0.5), TIDY_RULES).startsWith(' ')).toBe(false)
  })

  it('writes nothing for a stretch nobody spoke in', () => {
    const flow = new ScribeFlow()
    expect(flow.next([], TIDY_RULES)).toBe('')
    expect(flow.next(said('   ', 0, 0.4), TIDY_RULES)).toBe('')
    // Nothing went out, so the stretch that really has words is still the first
    // one and carries no space in front of it.
    expect(flow.next(said('there', 1, 1.5), TIDY_RULES)).toBe('There.')
  })

  it('starts the next dictation clean', () => {
    const flow = new ScribeFlow()
    flow.next(said('one', 0, 0.4), TIDY_RULES)
    flow.reset()
    expect(flow.next(said('two', 0, 0.4), TIDY_RULES)).toBe('Two.')
  })

  // Each stretch is tidied on its own, which is what keeps what is already on
  // somebody's screen from being rewritten under them. Tidying the whole of a
  // dictation again every time would move the mark at the end of the last
  // sentence, and nothing here can reach into another app to take it back.
  it('never says a word it has already written', () => {
    const flow = new ScribeFlow()
    const first = flow.next(said('draw the rows', 0, 1.2), TIDY_RULES)
    const second = flow.next(said('then the header', 2.4, 3.6), TIDY_RULES)
    expect(second).not.toContain('draw')
    expect(`${first}${second}`).toBe('Draw the rows. Then the header.')
  })

  // A correction reaches back over what is still being held and no further.
  it('takes back a sentence it has not written yet', () => {
    const flow = new ScribeFlow()
    const chunks = [
      { text: 'open the file', start: 0, end: 1.2 },
      { text: 'scratch that', start: 2.4, end: 3 },
      { text: 'open the folder', start: 3.6, end: 4.8 }
    ]
    expect(flow.next(chunks, TIDY_RULES)).toBe('Open the folder.')
  })
})

describe('the paste a dictation writes with', () => {
  it('is never heard as somebody pressing the key', () => {
    const sent = 1_000_000
    expect(ownKey(sent, sent + 10)).toBe(true)
    expect(ownKey(sent, sent + OWN_MS - 1)).toBe(true)
  })

  it('is over quickly enough that the next real press is heard', () => {
    const sent = 1_000_000
    expect(ownKey(sent, sent + OWN_MS)).toBe(false)
    expect(ownKey(sent, sent + 4000)).toBe(false)
  })

  it('says nothing about a machine that has never pasted', () => {
    expect(ownKey(0, 1_000_000)).toBe(false)
  })
})
