import { describe, expect, it } from 'vitest'
import { holdsBack, joinHeld, type Landing } from '../src/shared/scribeLanding'

// What happens to a dictation that found nothing to write into. The rule that
// reads the machine's answer is held in `scribe-landing`, and this is the pair of
// decisions taken on it: whether the words are held back at all, and what the card
// says once several stretches of one dictation have arrived.
//
// Both are here rather than in main because that is what makes them readable at
// all: the window they run in imports electron, and a suite cannot.

const AIMS: Landing[] = ['text', 'none', 'unknown']

describe('whether the words are held back', () => {
  it('holds them only when the machine said there was nothing to type in', () => {
    expect(holdsBack('paste', 'none')).toBe(true)
  })

  // The two answers that are not a refusal both paste, which is the whole of the
  // safety in this: a machine that would not say, and every machine that cannot be
  // asked, behave exactly as they did before any of this existed.
  it('pastes when the machine found a text box', () => {
    expect(holdsBack('paste', 'text')).toBe(false)
  })

  it('pastes when the machine would not say', () => {
    expect(holdsBack('paste', 'unknown')).toBe(false)
  })

  // Copying was already the answer to wanting the words on the clipboard. A
  // dictation aimed there has somewhere to go whatever has the caret, so holding
  // it would be a card standing in front of a setting somebody chose.
  it('never holds a dictation that was going to the clipboard anyway', () => {
    for (const aim of AIMS) expect(holdsBack('copy', aim)).toBe(false)
  })
})

describe('the words on the card', () => {
  it('is the first stretch, with nothing in front of it', () => {
    expect(joinHeld('', ' Hello, hello.')).toBe('Hello, hello.')
  })

  // A stretch already carries the space that keeps it off the end of the one
  // before it, so putting one in here would double it.
  it('joins the stretches with nothing between them', () => {
    expect(joinHeld('Hello, hello.', ' And again.')).toBe('Hello, hello. And again.')
  })

  it('reads as the whole of what somebody said, however many stretches it came in', () => {
    const said = [' Hello, hello,', ' hello,', ' hello.']
    expect(said.reduce(joinHeld, '')).toBe('Hello, hello, hello, hello.')
  })

  // Only the front is trimmed. What somebody said is theirs, and a dictation that
  // really ended on a space is one the next stretch joins onto.
  it('keeps the space a stretch ends on, because the next one joins onto it', () => {
    expect(joinHeld('Hello ', 'again.')).toBe('Hello again.')
  })
})
