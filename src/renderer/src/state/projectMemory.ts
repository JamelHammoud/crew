import type { PanelMemory } from './browser'

export interface ProjectMemory {
  panel: PanelMemory
  openThreadIds: string[]
}

const held = new Map<string, ProjectMemory>()

export const stashProject = (key: string, memory: ProjectMemory): void => {
  held.set(key, memory)
}

export const recallProject = (key: string): ProjectMemory | null => held.get(key) ?? null

export const forgetProject = (key: string): void => {
  held.delete(key)
}
