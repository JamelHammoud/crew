import { create } from 'zustand'

type HeaderSlotState = {
  node: HTMLElement | null
  hold(node: HTMLElement | null): void
}

export const useHeaderSlot = create<HeaderSlotState>(set => ({
  node: null,
  hold: node => set({ node })
}))
