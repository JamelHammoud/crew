import { describe, expect, it } from 'vitest'
import {
  DOC_EDGE,
  DOC_GUTTER,
  DOC_MAX_W,
  DOC_TOP,
  docLeft,
  trailInset
} from '../src/renderer/src/components/doc/docsLayout'
import { HEADER_EDGE } from '../src/renderer/src/state/headerSlot'

const RAIL = 264
const TOP_BAR = 70

describe('where the writing stands', () => {
  it('takes the middle of the page, whether or not the rail is pinned', () => {
    for (const page of [1440, 1440 - RAIL, 1920 - RAIL]) {
      expect(docLeft(page)).toBe((page - DOC_MAX_W) / 2)
      expect(docLeft(page) + DOC_MAX_W).toBe(page - docLeft(page))
    }
  })

  it('keeps an edge to itself once the page is too narrow to centre it', () => {
    for (const page of [400, 700, 780]) expect(docLeft(page)).toBe(DOC_EDGE)
  })

  it('comes to rest under the bar rather than a scrim below it', () => {
    expect(DOC_TOP).toBeGreaterThan(TOP_BAR)
    expect(DOC_TOP - TOP_BAR).toBeLessThan(TOP_BAR / 2)
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
