import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { openaiUrl } from '../../shared/modelServers'
import { cachedRuntimes, type LocalRuntime } from './local-serve'

export interface LocalModel {
  name: string
  tools?: boolean
}

interface Served {
  name: string
  digest?: string
}

const REGISTRIES = new Set(['registry.ollama.ai', 'registry.ollama.com', 'ollama.ai', 'ollama.com'])

const WALK_DEPTH = 5
const READ_MS = 2500

const toolsSaid = new Map<string, boolean>()

// Kept per server rather than as one list, because a server is a provider of
// its own now: models pooled across all of them would offer everything on
// somebody's laptop under the name of a machine down the hall.
const servedBy = new Map<string, string[]>()

function names(at: string, wanted: 'dir' | 'file'): string[] {
  try {
    return readdirSync(at, { withFileTypes: true })
      .filter(entry => !entry.name.startsWith('.') && (wanted === 'dir' ? entry.isDirectory() : entry.isFile()))
      .map(entry => entry.name)
  } catch {
    return []
  }
}

function filesUnder(root: string, depth = WALK_DEPTH): string[][] {
  const here = names(root, 'file').map(name => [name])
  if (depth <= 0) return here
  const below = names(root, 'dir').flatMap(dir => filesUnder(join(root, dir), depth - 1).map(rest => [dir, ...rest]))
  return [...below, ...here]
}

function modelName(segments: string[]): string {
  const parts = [...segments]
  if (parts.length > 2 && REGISTRIES.has(parts[0])) parts.shift()
  if (parts.length > 1 && parts[0] === 'library') parts.shift()
  const tag = parts.pop()
  if (!tag) return ''
  return parts.length ? `${parts.join('/')}:${tag}` : tag
}

function ollamaDisk(home: string, env: NodeJS.ProcessEnv): string[] {
  const root = env.OLLAMA_MODELS?.trim() || join(home, '.ollama', 'models')
  return filesUnder(join(root, 'manifests')).map(modelName).filter(Boolean)
}

function lmStudioDisk(home: string): string[] {
  const root = join(home, '.lmstudio', 'models')
  return names(root, 'dir').flatMap(publisher =>
    names(join(root, publisher), 'dir').map(repo => `${publisher}/${repo}`)
  )
}

export function diskModels(home = homedir(), env: NodeJS.ProcessEnv = process.env): string[] {
  return [...new Set([...ollamaDisk(home, env), ...lmStudioDisk(home)])]
}

async function asked(url: string, body?: unknown, key?: string): Promise<unknown> {
  try {
    const answer = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(key ? { authorization: `Bearer ${key}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(READ_MS)
    })
    if (!answer.ok) return null
    return await answer.json()
  } catch {
    return null
  }
}

function fromTags(said: unknown): Served[] {
  const listed = (said as { models?: unknown })?.models
  if (!Array.isArray(listed)) return []
  return listed
    .map(one => {
      const model = one as { name?: unknown; model?: unknown; digest?: unknown }
      const name = typeof model?.name === 'string' ? model.name : typeof model?.model === 'string' ? model.model : ''
      return { name, digest: typeof model?.digest === 'string' ? model.digest : undefined }
    })
    .filter(one => one.name.length > 0)
}

function fromList(said: unknown): Served[] {
  const listed = (said as { data?: unknown })?.data
  if (!Array.isArray(listed)) return []
  return listed
    .map(one => (one as { id?: unknown })?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map(name => ({ name }))
}

async function servedOn(runtime: LocalRuntime): Promise<Served[]> {
  if (runtime.kind === 'ollama') return fromTags(await asked(`${runtime.url}/api/tags`, undefined, runtime.key))
  return fromList(await asked(openaiUrl(runtime.url, '/models'), undefined, runtime.key))
}

export async function servedModels(runtime: LocalRuntime): Promise<LocalModel[]> {
  return (await servedOn(runtime)).map(one => ({ name: one.name }))
}

function readsTools(said: unknown): boolean {
  const able = (said as { capabilities?: unknown })?.capabilities
  if (!Array.isArray(able) || able.length === 0) return true
  return able.some(one => typeof one === 'string' && one.toLowerCase() === 'tools')
}

async function toolsOf(runtime: LocalRuntime, model: Served): Promise<boolean> {
  if (runtime.kind !== 'ollama') return true
  const held = model.digest ? toolsSaid.get(model.digest) : undefined
  if (held !== undefined) return held
  const able = readsTools(await asked(`${runtime.url}/api/show`, { model: model.name }, runtime.key))
  if (model.digest) toolsSaid.set(model.digest, able)
  return able
}

export async function refreshModels(runtimes: LocalRuntime[]): Promise<string[]> {
  const lists = await Promise.all(
    runtimes.map(async runtime => {
      const models = await servedOn(runtime)
      const checked = await Promise.all(
        models.map(async (model): Promise<LocalModel> => ({ name: model.name, tools: await toolsOf(runtime, model) }))
      )
      const kept: string[] = []
      for (const model of checked) {
        if (model.tools === false || kept.includes(model.name)) continue
        kept.push(model.name)
      }
      servedBy.set(runtime.url, kept)
      return kept
    })
  )
  const all: string[] = []
  for (const model of lists.flat()) if (!all.includes(model)) all.push(model)
  return all
}

export function modelsServedOn(urls: readonly string[]): string[] {
  const kept: string[] = []
  for (const url of urls) for (const model of servedBy.get(url) ?? []) if (!kept.includes(model)) kept.push(model)
  return kept
}

// What this computer is running, which is the runtimes found here and never a
// server somebody wrote down. Asked of everything ever refreshed instead, a
// server that has gone leaves its models standing in the picker forever.
export function localModels(): string[] {
  const served = modelsServedOn(cachedRuntimes().map(runtime => runtime.url))
  return served.length ? served : diskModels()
}
