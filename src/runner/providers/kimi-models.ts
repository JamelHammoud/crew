import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONFIG_PATHS = ['.kimi-code/config.toml', '.kimi/config.toml']

export function kimiModels(home = homedir()): string[] {
  for (const path of CONFIG_PATHS) {
    let text: string
    try {
      text = readFileSync(join(home, path), 'utf8')
    } catch {
      continue
    }
    const found = [...text.matchAll(/^\[models\."([^"]+)"\]/gm)].map(match => match[1])
    if (found.length) return found
  }
  return []
}
