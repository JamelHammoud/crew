import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface CodexCatalog {
  models: string[]
  efforts: string[]
}

// Used when the codex CLI has not written its model cache yet.
const FALLBACK: CodexCatalog = {
  models: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5'],
  efforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']
}

interface CachedModel {
  slug?: unknown
  visibility?: unknown
  priority?: unknown
  supported_reasoning_levels?: Array<{ effort?: unknown }>
}

export function codexModels(home = homedir()): CodexCatalog {
  let cached: { models?: CachedModel[] }
  try {
    cached = JSON.parse(readFileSync(join(home, '.codex', 'models_cache.json'), 'utf8'))
  } catch {
    return FALLBACK
  }
  const listed = (Array.isArray(cached?.models) ? cached.models : [])
    .filter(m => typeof m?.slug === 'string' && m.visibility !== 'hide')
    .sort((a, b) => (typeof a.priority === 'number' ? a.priority : 0) - (typeof b.priority === 'number' ? b.priority : 0))
  if (listed.length === 0) return FALLBACK
  const efforts: string[] = []
  for (const model of listed) {
    for (const level of model.supported_reasoning_levels ?? []) {
      if (typeof level?.effort === 'string' && !efforts.includes(level.effort)) efforts.push(level.effort)
    }
  }
  return {
    models: listed.map(m => m.slug as string),
    efforts: efforts.length ? efforts : FALLBACK.efforts
  }
}
