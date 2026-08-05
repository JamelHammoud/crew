// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bringInto, centerIn, scrollerOf } from '../src/renderer/src/components/scrollInto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const renderer = path.join(root, 'src/renderer/src')

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const at = path.join(dir, entry.name)
    return entry.isDirectory() ? files(at) : [at]
  })

const scroller = (overflow: string, w: number, h: number): HTMLElement => {
  const el = document.createElement('div')
  el.style.overflowX = overflow
  el.style.overflowY = overflow
  Object.defineProperty(el, 'clientWidth', { value: w, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: h, configurable: true })
  Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true })
  el.getBoundingClientRect = () => ({ top: 0, left: 0, width: w, height: h }) as DOMRect
  return el
}

const rowIn = (page: HTMLElement, left: number, top: number, w: number, h: number): HTMLElement => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ left: left - page.scrollLeft, top: top - page.scrollTop, width: w, height: h }) as DOMRect
  page.appendChild(el)
  return el
}

describe('bringing something into the box it stands in', () => {
  it('leaves a box that is already standing in view where it is', () => {
    const page = scroller('auto', 300, 36)
    const pill = rowIn(page, 100, 0, 90, 36)
    bringInto(pill, page)
    expect(page.scrollLeft).toBe(0)
  })

  it('moves the least it can to reach one past the far edge', () => {
    const page = scroller('auto', 300, 36)
    const pill = rowIn(page, 400, 0, 90, 36)
    bringInto(pill, page)
    expect(page.scrollLeft).toBe(190)
  })

  it('goes back for one that has fallen off the near edge', () => {
    const page = scroller('auto', 300, 36)
    page.scrollLeft = 190
    const pill = rowIn(page, 0, 0, 90, 36)
    bringInto(pill, page)
    expect(page.scrollLeft).toBe(0)
  })

  it('never moves the way the row does not go', () => {
    const page = scroller('auto', 300, 36)
    const pill = rowIn(page, 400, 0, 90, 36)
    bringInto(pill, page)
    expect(page.scrollTop).toBe(0)
  })

  it('puts a line in the middle where that is what is wanted', () => {
    const page = scroller('auto', 300, 200)
    const line = rowIn(page, 0, 100, 300, 20)
    centerIn(line, page)
    expect(page.scrollTop).toBe(10)
  })

  it('leaves the other way alone while it does', () => {
    const page = scroller('auto', 300, 200)
    page.scrollLeft = 40
    const line = rowIn(page, 0, 100, 300, 20)
    centerIn(line, page)
    expect(page.scrollLeft).toBe(40)
  })
})

describe('the box it is allowed to move', () => {
  it('is the nearest one that really scrolls', () => {
    const page = scroller('auto', 300, 200)
    const inner = document.createElement('div')
    page.appendChild(inner)
    const row = rowIn(inner, 0, 0, 10, 10)
    expect(scrollerOf(row)).toBe(page)
  })

  it('is never one that only clips, however near it stands', () => {
    const page = scroller('auto', 300, 200)
    const clips = scroller('hidden', 300, 200)
    page.appendChild(clips)
    const row = rowIn(clips, 0, 0, 10, 10)
    expect(scrollerOf(row)).toBe(page)
  })

  it('is nothing at all rather than the page, where nothing above it scrolls', () => {
    const clips = scroller('hidden', 300, 200)
    document.body.appendChild(clips)
    const row = rowIn(clips, 0, 400, 10, 10)
    expect(scrollerOf(row)).toBe(null)
    bringInto(row)
    expect(clips.scrollTop).toBe(0)
  })
})
