import { describe, expect, it } from 'vitest'
import {
  DOC_GAP,
  DOC_GUTTER,
  DOC_MAX_W,
  PAGE_LIST_W,
  docInset,
  docLeft,
  trailInset
} from '../src/renderer/src/components/doc/docsLayout'
import { HEADER_EDGE } from '../src/renderer/src/state/headerSlot'

const RAIL = 264

describe('where the writing stands', () => {
  it('never runs under the list of pages, however tight the window is', () => {
    for (const page of [600, 800, 1000, 1120 - RAIL, 1440 - RAIL]) {
      expect(docLeft(page)).toBeGreaterThanOrEqual(PAGE_LIST_W + DOC_GAP)
      expect(docInset(page)).toBeGreaterThanOrEqual(DOC_GAP)
    }
  })

  it('takes the middle of the page once there is room for it there', () => {
    const page = 1900
    expect(docLeft(page)).toBe((page - DOC_MAX_W) / 2)
    expect(docLeft(page) + DOC_MAX_W).toBe(page - docLeft(page))
  })

  it('holds its measure rather than shrinking to sit in the middle', () => {
    const page = 1440 - RAIL
    expect(docLeft(page)).toBe(PAGE_LIST_W + DOC_GAP)
    expect(page - docLeft(page)).toBeGreaterThan(DOC_MAX_W)
  })
})

describe('the trail in the header', () => {
  const room = (corner: number, pinned: boolean): number => Math.max(0, corner - (pinned ? RAIL : 0) - HEADER_EDGE)

  it('stands where the title under it stands', () => {
    const page = 1440 - RAIL
    const held = room(RAIL, true)
    expect(HEADER_EDGE + held + trailInset(page, held)).toBe(docLeft(page) + DOC_GUTTER)
  })

  it('is never pulled back into the window corner', () => {
    for (const page of [400, 700, 1176]) expect(trailInset(page, 400)).toBeGreaterThanOrEqual(0)
  })
})
