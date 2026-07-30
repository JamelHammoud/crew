// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { FOCUSED_IN_PAGE, landingInPage, type Landing } from '../src/shared/scribeLanding'

// The half of Crew's own caret no rule can see. `landingInPage` is held to the tag
// and the type it is handed; this is whether a real document hands those over at
// all, which is the thing the machine was never able to say about a Chromium
// window and the whole reason the app was holding words back from its own
// composer.
//
// So the snippet is run rather than read: a real page, a real focus, and the rule
// reading what really came back off it. A suite that made the shape up by hand
// would have passed the entire time this was broken.

function reads(): Landing | null {
  const focused = eval(FOCUSED_IN_PAGE) as { tag: string; type: string; editable: boolean } | null
  if (!focused) return null
  return landingInPage(focused.tag, focused.type, focused.editable)
}

function page(html: string, pick: string): Landing | null {
  document.body.innerHTML = html
  const el = document.querySelector(pick)
  if (!(el instanceof HTMLElement)) throw new Error(`nothing to focus at ${pick}`)
  el.focus()
  return reads()
}

describe('reading the caret off one of our own pages', () => {
  it('writes into the composer', () => {
    expect(page('<textarea id="a"></textarea>', '#a')).toBe('text')
  })

  it('writes into a field', () => {
    expect(page('<input id="a" type="text">', '#a')).toBe('text')
    expect(page('<input id="a" type="search">', '#a')).toBe('text')
  })

  // A field with no type on it at all, which is what most of the app's own are.
  it('writes into a field that never said what it was', () => {
    expect(page('<input id="a">', '#a')).toBe('text')
  })

  it('writes into a box the app drew itself', () => {
    expect(page('<div id="a" contenteditable="true"></div>', '#a')).toBe('text')
  })

  it('holds the words back on a button', () => {
    expect(page('<button id="a">Send</button>', '#a')).toBe('none')
    expect(page('<input id="a" type="checkbox">', '#a')).toBe('none')
  })

  // Nothing focused at all, which is the case the card was written for and the one
  // place in the whole feature a 'none' is really earned.
  it('holds the words back when nothing in the page has the caret', () => {
    document.body.innerHTML = '<button id="a">Send</button>'
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(reads()).toBe('none')
  })

  // The document hands back the host of a shadow root rather than what is inside
  // it, so without the walk a box drawn in one reads as whatever it was drawn in.
  it('walks into a shadow root to find the box in it', () => {
    document.body.innerHTML = '<div id="host"></div>'
    const host = document.querySelector('#host') as HTMLElement
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = '<textarea id="inner"></textarea>'
    const inner = root.querySelector('#inner') as HTMLTextAreaElement
    inner.focus()
    expect(document.activeElement).toBe(host)
    expect(reads()).toBe('text')
  })

  it('says the page carries no focused element rather than guessing at one', () => {
    document.body.innerHTML = ''
    expect(typeof FOCUSED_IN_PAGE).toBe('string')
    expect(reads()).toBe('none')
  })
})
