import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import {
  diskModels,
  localModels,
  modelsServedOn,
  refreshModels,
  servedModels
} from '../src/runner/providers/local-models'
import {
  answering,
  cachedRuntimes,
  candidateUrls,
  findRuntimes,
  type LocalRuntime
} from '../src/runner/providers/local-serve'

interface Fake {
  url: string
  close: () => Promise<void>
}

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void

const standing: Fake[] = []

function say(res: ServerResponse, body: unknown, code = 200): void {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function boot(handle: Handler): Promise<Fake> {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
    })
    req.on('end', () => handle(req, res, body))
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const fake: Fake = {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>(done => {
        server.close(() => done())
      })
  }
  standing.push(fake)
  return fake
}

function tagged(name: string, digest = `sha256:${name}`): Record<string, unknown> {
  return { name, model: name, digest, size: 4920753328, modified_at: '2026-07-30T10:00:00Z' }
}

async function ollamaOn(
  models: Array<Record<string, unknown>>,
  able: Record<string, string[] | null>,
  shows: string[] = []
): Promise<Fake> {
  return boot((req, res, body) => {
    const path = (req.url ?? '').split('?')[0]
    if (req.method === 'GET' && path === '/api/tags') return say(res, { models })
    if (req.method === 'POST' && path === '/api/show') {
      const asked = (JSON.parse(body || '{}') as { model?: string }).model ?? ''
      shows.push(asked)
      const capabilities = able[asked]
      return say(res, capabilities ? { capabilities } : { details: { family: 'llama' } })
    }
    say(res, { error: 'not found' }, 404)
  })
}

function openaiOn(ids: string[]): Promise<Fake> {
  return boot((req, res) => {
    const path = (req.url ?? '').split('?')[0]
    if (req.method === 'GET' && path === '/v1/models') {
      return say(res, { object: 'list', data: ids.map(id => ({ id, object: 'model' })) })
    }
    say(res, { error: 'not found' }, 404)
  })
}

function manifest(root: string, path: string): void {
  const at = join(root, 'manifests', path)
  mkdirSync(dirname(at), { recursive: true })
  writeFileSync(at, JSON.stringify({ schemaVersion: 2, layers: [] }))
}

afterAll(async () => {
  await Promise.all(standing.splice(0).map(fake => fake.close()))
})

describe('what this machine has on disk', () => {
  const home = mkdtempSync(join(tmpdir(), 'local-home-'))
  const moved = mkdtempSync(join(tmpdir(), 'local-models-'))

  manifest(join(home, '.ollama', 'models'), join('registry.ollama.ai', 'library', 'llama3.2', '3b'))
  manifest(join(home, '.ollama', 'models'), join('registry.ollama.ai', 'library', 'qwen3', '8b'))
  manifest(join(home, '.ollama', 'models'), join('hf.co', 'someone', 'a-gguf', 'latest'))
  mkdirSync(join(home, '.lmstudio', 'models', 'lmstudio-community', 'Qwen3-8B-GGUF'), { recursive: true })
  manifest(moved, join('registry.ollama.ai', 'library', 'moved-away', 'latest'))

  it('reads a manifest folder with no server anywhere', () => {
    expect(diskModels(home, {}).sort()).toEqual([
      'hf.co/someone/a-gguf:latest',
      'llama3.2:3b',
      'lmstudio-community/Qwen3-8B-GGUF',
      'qwen3:8b'
    ])
  })

  it('follows OLLAMA_MODELS where somebody has moved the root', () => {
    const said = diskModels(home, { OLLAMA_MODELS: moved })
    expect(said).toContain('moved-away:latest')
    expect(said).not.toContain('llama3.2:3b')
  })

  it('is an empty list when there is nothing on this machine', () => {
    expect(diskModels(join(home, 'nowhere'), {})).toEqual([])
  })

  it('reads what is on disk before anything has answered', async () => {
    const was = { home: process.env.HOME, models: process.env.OLLAMA_MODELS }
    process.env.HOME = home
    delete process.env.OLLAMA_MODELS
    vi.resetModules()
    try {
      const fresh = await import('../src/runner/providers/local-models')
      expect(fresh.localModels()).toContain('llama3.2:3b')
    } finally {
      if (was.home === undefined) delete process.env.HOME
      else process.env.HOME = was.home
      if (was.models !== undefined) process.env.OLLAMA_MODELS = was.models
    }
  })
})

describe('what a running server says it has', () => {
  it('reads the list off a served /api/tags', async () => {
    const fake = await ollamaOn([tagged('llama3.2:3b'), tagged('qwen3:8b')], {})
    const runtime: LocalRuntime = { url: fake.url, label: 'Ollama', kind: 'ollama' }
    expect((await servedModels(runtime)).map(one => one.name)).toEqual(['llama3.2:3b', 'qwen3:8b'])
  })

  it('reads the list off /v1/models where that is the surface', async () => {
    const fake = await openaiOn(['qwen3-8b-mlx', 'gemma-3-12b'])
    const runtime: LocalRuntime = { url: fake.url, label: 'LM Studio', kind: 'openai' }
    expect((await servedModels(runtime)).map(one => one.name)).toEqual(['qwen3-8b-mlx', 'gemma-3-12b'])
  })

  it('is an empty list rather than a throw when the shape is not the one expected', async () => {
    const fake = await boot((_req, res) => say(res, { models: 'not a list' }))
    expect(await servedModels({ url: fake.url, label: 'Ollama', kind: 'ollama' })).toEqual([])
  })
})

describe('the models a run can be given', () => {
  it('leaves out a model that says outright it cannot call tools', async () => {
    const fake = await ollamaOn([tagged('agent:8b'), tagged('embed:1b')], {
      'agent:8b': ['completion', 'tools'],
      'embed:1b': ['embedding']
    })
    const kept = await refreshModels([{ url: fake.url, label: 'Ollama', kind: 'ollama' }])
    expect(kept).toEqual(['agent:8b'])
  })

  it('keeps a model that says nothing at all about tools', async () => {
    const fake = await ollamaOn([tagged('quiet:8b')], {})
    expect(await refreshModels([{ url: fake.url, label: 'Ollama', kind: 'ollama' }])).toEqual(['quiet:8b'])
  })

  it('asks nothing of a runtime that has no such call to make', async () => {
    const fake = await openaiOn(['qwen3-8b-mlx'])
    expect(await refreshModels([{ url: fake.url, label: 'LM Studio', kind: 'openai' }])).toEqual(['qwen3-8b-mlx'])
  })

  it('folds two runtimes together without saying one model twice', async () => {
    const one = await ollamaOn([tagged('shared:8b'), tagged('mine:3b')], {})
    const two = await openaiOn(['shared:8b', 'theirs:7b'])
    const kept = await refreshModels([
      { url: one.url, label: 'Ollama', kind: 'ollama' },
      { url: two.url, label: 'LM Studio', kind: 'openai' }
    ])
    expect(kept).toEqual(['shared:8b', 'mine:3b', 'theirs:7b'])
  })

  it('costs nothing to ask a second time, since the digest already answered', async () => {
    const shows: string[] = []
    const fake = await ollamaOn([tagged('cached:8b', 'sha256:abc')], { 'cached:8b': ['tools'] }, shows)
    const runtime: LocalRuntime = { url: fake.url, label: 'Ollama', kind: 'ollama' }
    await refreshModels([runtime])
    expect(shows).toEqual(['cached:8b'])
    await refreshModels([runtime])
    expect(shows).toEqual(['cached:8b'])
  })

  it('hands back what this computer is really running rather than the disk', async () => {
    const fake = await ollamaOn([tagged('standing:8b')], {})
    const was = process.env.OLLAMA_HOST
    process.env.OLLAMA_HOST = fake.url
    try {
      await refreshModels(await findRuntimes())
      expect(localModels()).toContain('standing:8b')
    } finally {
      if (was === undefined) delete process.env.OLLAMA_HOST
      else process.env.OLLAMA_HOST = was
    }
  })

  // A server is a provider of its own, so what it serves is asked for by
  // address. Pooled, a model down the hall was offered under Ollama's name.
  it('keeps each server to the models that server really has', async () => {
    const one = await ollamaOn([tagged('shared:8b'), tagged('mine:3b')], {})
    const two = await openaiOn(['shared:8b', 'theirs:7b'])
    await refreshModels([
      { url: one.url, label: 'Ollama', kind: 'ollama' },
      { url: two.url, label: 'The rack', kind: 'openai' }
    ])
    expect(modelsServedOn([one.url])).toEqual(['shared:8b', 'mine:3b'])
    expect(modelsServedOn([two.url])).toEqual(['shared:8b', 'theirs:7b'])
    expect(modelsServedOn(['http://192.0.2.10:39862/v1'])).toEqual([])
  })
})

describe('who is answering on this machine', () => {
  it('asks the three addresses a local server is usually on', () => {
    expect(candidateUrls({})).toEqual([
      'http://127.0.0.1:11434',
      'http://127.0.0.1:1234',
      'http://127.0.0.1:8080'
    ])
  })

  it('reads OLLAMA_HOST first, however it was written', () => {
    expect(candidateUrls({ OLLAMA_HOST: '127.0.0.1:11500' })[0]).toBe('http://127.0.0.1:11500')
    expect(candidateUrls({ OLLAMA_HOST: '127.0.0.1' })[0]).toBe('http://127.0.0.1:11434')
    expect(candidateUrls({ OLLAMA_HOST: 'http://127.0.0.1:11500/' })[0]).toBe('http://127.0.0.1:11500')
  })

  it('says an address once when OLLAMA_HOST is the one it was going to ask anyway', () => {
    expect(candidateUrls({ OLLAMA_HOST: '127.0.0.1:11434' })).toEqual(candidateUrls({}))
  })

  it('reads a served /api/tags as Ollama and a served /v1/models as the other kind', async () => {
    const ollama = await ollamaOn([tagged('llama3.2:3b')], {})
    const openai = await openaiOn(['qwen3-8b-mlx'])
    expect(await answering(ollama.url)).toEqual({ url: ollama.url, label: 'Ollama', kind: 'ollama' })
    expect((await answering(openai.url))?.kind).toBe('openai')
  })

  it('is nobody when nothing answers there', async () => {
    const fake = await boot((_req, res) => say(res, {}))
    await fake.close()
    expect(await answering(fake.url, 500)).toBeNull()
  })

  it('keeps the ones that answered, in the order they were asked', async () => {
    const fake = await ollamaOn([tagged('llama3.2:3b')], {})
    const was = process.env.OLLAMA_HOST
    process.env.OLLAMA_HOST = fake.url
    try {
      const runtimes = await findRuntimes()
      expect(runtimes[0]).toEqual({ url: fake.url, label: 'Ollama', kind: 'ollama' })
      expect(cachedRuntimes()).toEqual(runtimes)
    } finally {
      if (was === undefined) delete process.env.OLLAMA_HOST
      else process.env.OLLAMA_HOST = was
    }
  })
})
