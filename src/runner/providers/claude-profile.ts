import os from 'node:os'
import path from 'node:path'
import { CLAUDE_ACCOUNT_KEY, claudeProfileId } from '../../shared/claude'
import type { AgentSettings } from '../../shared/llm'

export { CLAUDE_ACCOUNT_KEY, claudeProfileId }

export function claudeConfigDir(name: string, home = os.homedir()): string | null {
  const id = claudeProfileId(name)
  return id ? path.join(home, '.crew', 'claude', id) : null
}

export function claudeConfigFor(settings: AgentSettings = {}, home = os.homedir()): string | null {
  return claudeConfigDir(settings[CLAUDE_ACCOUNT_KEY] ?? '', home)
}
