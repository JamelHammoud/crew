import { HEADER_EDGE } from '../../state/headerSlot'
import { TOP_BAR_H } from '../TopBar'

export const DOC_MAX_W = 760
export const DOC_GUTTER = 54
export const DOC_EDGE = 24
export const DOC_TOP = TOP_BAR_H + 18

export function docLeft(page: number): number {
  return Math.max(DOC_EDGE, (page - DOC_MAX_W) / 2)
}

export function trailInset(page: number, room: number): number {
  return Math.max(0, docLeft(page) + DOC_GUTTER - HEADER_EDGE - room)
}
