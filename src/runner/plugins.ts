import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { mcpServersOf, type CrewPlugin } from '../shared/plugins'
import type { McpHandover, McpRun } from './providers/types'

const CONFIG_MODE = 0o600

export function machineKeys(
  plugins: readonly CrewPlugin[],
  env: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const plugin of plugins) {
    for (const key of plugin.keys ?? []) {
      const scoped = env[`${plugin.name}:${key.name}`]
      const plain = env[key.name]
      if (scoped) out[`${plugin.name}:${key.name}`] = scoped
      else if (plain) out[key.name] = plain
    }
  }
  return out
}

const configPath = (id: string): string => {
  const named = id.replace(/[^a-z0-9-]/gi, '')
  return path.join(os.tmpdir(), `crew-mcp-${named || randomUUID()}.json`)
}

export function openMcp(plugins: readonly CrewPlugin[], how: McpHandover | undefined, id: string): McpRun | null {
  if (!how || !plugins.length) return null
  const servers = mcpServersOf(plugins, machineKeys(plugins))
  if (!Object.keys(servers).length) return null
  if (how === 'inline') return { servers, file: '' }
  const file = configPath(id)
  fs.writeFileSync(file, JSON.stringify({ mcpServers: servers }), { mode: CONFIG_MODE })
  return { servers, file }
}

export function closeMcp(run: McpRun | null): void {
  if (run?.file) fs.rmSync(run.file, { force: true })
}
