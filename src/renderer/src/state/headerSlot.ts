import { create } from 'zustand'

export const HEADER_EDGE = 24

const PLACES = ['backdrop', 'left', 'center', 'right'] as const

export type HeaderPlace = (typeof PLACES)[number]

type Nodes = Record<HeaderPlace, HTMLElement | null>

type HeaderSlotState = {
  nodes: Nodes
  hold: Record<HeaderPlace, (node: HTMLElement | null) => void>
  corner: number
  own: number
  measure(part: 'corner' | 'own', width: number): void
}

const empty = Object.fromEntries(PLACES.map(place => [place, null])) as Nodes

export const useHeaderSlot = create<HeaderSlotState>(set => ({
  nodes: empty,
  hold: Object.fromEntries(
    PLACES.map(place => [
      place,
      (node: HTMLElement | null) => set(state => ({ nodes: { ...state.nodes, [place]: node } }))
    ])
  ) as HeaderSlotState['hold'],
  corner: 0,
  own: 0,
  measure: (part, width) => set(state => (state[part] === width ? state : { [part]: width }))
}))

export function cornerRoom(corner: number, offset: number): number {
  return Math.max(0, corner - offset - HEADER_EDGE)
}
