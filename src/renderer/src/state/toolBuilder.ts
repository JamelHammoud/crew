import { useSyncExternalStore } from 'react'
import type { CrewTool } from '../../../shared/toolbox'

// Which tool is being built or changed, or none. It is held here rather than in
// the toolbox so the card never stands inside the popover that raised it: a
// floating layer is drawn above the dialog layer, so a card asked for from a
// menu that is still open is a card with that menu sitting on top of it.
let building: { tool: CrewTool | null } | null = null

const listeners = new Set<() => void>()

function say(): void {
  for (const listener of listeners) listener()
}

export function buildTool(tool: CrewTool | null = null): void {
  building = { tool }
  say()
}

export function closeBuilder(): void {
  building = null
  say()
}

export function useToolBuilder(): { tool: CrewTool | null } | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => building
  )
}
