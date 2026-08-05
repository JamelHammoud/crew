import { HEADER_EDGE } from '../../state/headerSlot'

export const PAGE_LIST_W = 256
export const DOC_MAX_W = 760
export const DOC_GUTTER = 54
export const DOC_GAP = 24

export function docLeft(page: number): number {
  return Math.max(PAGE_LIST_W + DOC_GAP, (page - DOC_MAX_W) / 2)
}

export function docInset(page: number): number {
  return docLeft(page) - PAGE_LIST_W
}

export function trailInset(page: number, room: number): number {
  return Math.max(0, docLeft(page) + DOC_GUTTER - HEADER_EDGE - room)
}
