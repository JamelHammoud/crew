// Whether a folder builds an iPhone app, and what it builds it from. The runner
// asks it to decide whether an agent hears about the simulator at all and main
// asks it to find the project to run, so it lives here rather than in either.

import { readdir } from 'node:fs/promises'
import path from 'node:path'

export type IosContainerKind = 'project' | 'workspace'

export interface IosContainer {
  path: string
  kind: IosContainerKind
}

export const PROJECT_LIMIT = 12

const SKIP = new Set(['.git', '.build', 'build', 'Carthage', 'DerivedData', 'node_modules', 'Pods'])

export async function projectContainers(folder: string): Promise<IosContainer[]> {
  const out: IosContainer[] = []
  const walk = async (at: string, depth: number): Promise<void> => {
    if (depth > 4 || out.length >= PROJECT_LIMIT) return
    const entries = await readdir(at, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (out.length >= PROJECT_LIMIT) return
      if (!entry.isDirectory() || SKIP.has(entry.name)) continue
      const target = path.join(at, entry.name)
      if (entry.name.endsWith('.xcworkspace')) {
        if (!target.includes('.xcodeproj/')) out.push({ path: target, kind: 'workspace' })
        continue
      }
      if (entry.name.endsWith('.xcodeproj')) {
        out.push({ path: target, kind: 'project' })
        continue
      }
      if (!entry.name.startsWith('.')) await walk(target, depth + 1)
    }
  }
  await walk(folder, 0)
  return out.sort((a, b) => (a.kind === b.kind ? a.path.localeCompare(b.path) : a.kind === 'workspace' ? -1 : 1))
}

export async function hasIosProject(folder: string): Promise<boolean> {
  return (await projectContainers(folder)).length > 0
}
