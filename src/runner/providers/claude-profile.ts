import os from 'node:os'
import path from 'node:path'
import type { AgentSettings } from '../../shared/llm'

export const CLAUDE_ACCOUNT_KEY = 'account'

export function claudeProfileId(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function claudeConfigDir(name: string, home = os.homedir()): string | null {
  const id = claudeProfileId(name)
  return id ? path.join(home, '.crew', 'claude', id) : null
}

export function claudeConfigFor(settings: AgentSettings = {}, home = os.homedir()): string | null {
  return claudeConfigDir(settings[CLAUDE_ACCOUNT_KEY] ?? '', home)
}
