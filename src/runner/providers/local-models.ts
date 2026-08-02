import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LocalRuntime } from './local-serve'

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

let served: string[] | null = null

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
  const below = names(root, 'dir').flatMap(dir =>
    filesUnder(join(root, dir), depth - 1).map(rest => [dir, ...rest])
  )
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

async function asked(url: string, body?: unknown): Promise<unknown> {
  try {
    const answer = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
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
    .map(one => ({ name: typeof (one as { id?: unknown })?.id === 'string' ? ((one as { id: string }).id) : '' }))
    .filter(one => one.name.length > 0)
}

async function servedOn(runtime: LocalRuntime): Promise<Served[]> {
  if (runtime.kind === 'ollama') return fromTags(await asked(`${runtime.url}/api/tags`))
  return fromList(await asked(`${runtime.url}/v1/models`))
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
  const able = readsTools(await asked(`${runtime.url}/api/show`, { model: model.name }))
  if (model.digest) toolsSaid.set(model.digest, able)
  return able
}

export async function refreshModels(runtimes: LocalRuntime[]): Promise<string[]> {
  const lists = await Promise.all(
    runtimes.map(async runtime => ({ runtime, models: await servedOn(runtime) }))
  )
  const checked = await Promise.all(
    lists.flatMap(({ runtime, models }) =>
      models.map(async (model): Promise<LocalModel> => ({ name: model.name, tools: await toolsOf(runtime, model) }))
    )
  )
  const kept: string[] = []
  for (const model of checked) {
    if (model.tools === false || kept.includes(model.name)) continue
    kept.push(model.name)
  }
  served = kept
  return kept
}

export function cachedModels(): string[] {
  return served?.length ? served : diskModels()
}
