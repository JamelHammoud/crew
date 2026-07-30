import { describe, expect, it } from 'vitest'
import { askCaret, CARET_SCRIPT } from '../src/main/scribe-caret'

// The order the two answers are asked in, and what happens when one of them never
// comes. Nothing here touches a keyboard or a machine: the machine is stood down
// by asking as a platform that has no way to be asked, so what is left is the one
// decision this file makes.

const NOWHERE = 'linux'

describe('asking our own windows before the machine', () => {
  it('takes the page at its word and never asks the machine', async () => {
    expect(await askCaret(async () => 'text', NOWHERE)).toBe('text')
    expect(await askCaret(async () => 'none', NOWHERE)).toBe('none')
  })

  // Null is the caret being in another application altogether, which is the whole
  // of what sends the question on.
  it('asks the machine when the caret is in somebody else’s application', async () => {
    expect(await askCaret(async () => null, NOWHERE)).toBe('unknown')
  })

  it('asks the machine when nothing was handed in to answer for us', async () => {
    expect(await askCaret(undefined, NOWHERE)).toBe('unknown')
  })

  // A page that never answers would leave a dictation with its words neither
  // pasted nor held, which is the one way of losing them this whole feature is
  // written to stop. It has to come back, and it has to come back pasting.
  it('does not wait forever on a window that never answers', async () => {
    const answer = await askCaret(() => new Promise(() => {}), NOWHERE)
    expect(answer).toBe('unknown')
  }, 10_000)

  it('carries on when the page falls over rather than taking the words with it', async () => {
    const thrown = await askCaret(() => {
      throw new Error('the window went')
    }, NOWHERE)
    expect(thrown).toBe('unknown')
    const rejected = await askCaret(() => Promise.reject(new Error('gone')), NOWHERE)
    expect(rejected).toBe('unknown')
  })
})

describe('the script the app really sends', () => {
  // The bug this was all about. A focused element that is missing value used to be
  // read as nothing having the caret, and it is a Chromium application that has
  // not built its accessibility tree, which is every application anybody really
  // dictates into. The focused window is the one read that tells the two apart, so
  // the silence must never be answered without asking for it.
  it('asks for the focused window before it makes anything of a missing element', () => {
    expect(CARET_SCRIPT).toContain('if el is missing value then')
    expect(CARET_SCRIPT).not.toContain('if el is missing value then return "none"')
    expect(CARET_SCRIPT).toContain('AXFocusedWindow')
    const silence = CARET_SCRIPT.slice(CARET_SCRIPT.indexOf('if el is missing value then'))
    expect(silence.indexOf('AXFocusedWindow')).toBeLessThan(silence.indexOf('return "none"'))
  })

  it('says nothing is open only when there is no focused window either', () => {
    expect(CARET_SCRIPT).toContain('if fw is missing value then return "none"')
  })

  it('reads the role as an attribute rather than as a property', () => {
    expect(CARET_SCRIPT).toContain('value of attribute "AXRole"')
  })

  // Somebody else's application, and the tree costs them for as long as it is on.
  it('never turns anybody’s accessibility tree on', () => {
    expect(CARET_SCRIPT).not.toContain('AXManualAccessibility')
    expect(CARET_SCRIPT).not.toContain('AXEnhancedUserInterface')
  })
})
