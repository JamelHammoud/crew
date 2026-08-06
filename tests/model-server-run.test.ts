import { createServer, type Server } from 'node:http'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localFields, serverProvider } from '../src/runner/providers/local'
import { allProviders } from '../src/runner/providers/detect'
import { checkServer, findRuntimes } from '../src/runner/providers/local-serve'
import { setServersPath } from '../src/runner/providers/local-servers'
import { refreshModels } from '../src/runner/providers/local-models'
import { serverProviderName, type ModelServer } from '../src/shared/modelServers'

interface Asked {
  path: string
  key?: string
}

interface Fake {
  url: string
  asked: Asked[]
  close: () => Promise<void>
}

const KEY = 'sk-written-down'

const sse = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`

async function fakeServer(wantsKey: boolean, prefix = '/v1'): Promise<Fake> {
  const asked: Asked[] = []
  const server: Server = createServer((req, res) => {
    const key = (req.headers.authorization ?? '').replace(/^Bearer /, '') || undefined
    asked.push({ path: req.url ?? '', key })
    if (wantsKey && key !== KEY) {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Authentication Error, No api key passed in.' } }))
      return
    }
    if (req.url === `${prefix}/models`) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [{ id: 'far/model' }] }))
      return
    }
    if (req.url === `${prefix}/chat/completions`) {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.end(sse('Reached you.'))
      return
    }
    res.writeHead(404).end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    url: `http://127.0.0.1:${port}${prefix}`,
    asked,
    close: () => new Promise<void>(resolve => void server.close(() => resolve()))
  }
}

let cwd = ''
let store = ''
let fake: Fake | null = null
const wasHost = process.env.OLLAMA_HOST

const holding = (servers: ModelServer[]) => {
  writeFileSync(store, JSON.stringify(servers))
  setServersPath(store)
}

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'crew-written-'))
  store = join(mkdtempSync(join(tmpdir(), 'crew-servers-')), 'model-servers.json')
  delete process.env.OLLAMA_HOST
})

afterEach(async () => {
  await fake?.close()
  fake = null
  setServersPath('')
  if (wasHost === undefined) delete process.env.OLLAMA_HOST
  else process.env.OLLAMA_HOST = wasHost
})

describe('a server written down by hand', () => {
  it('is asked under the path it was written with, rather than under a second one', async () => {
    fake = await fakeServer(false)
    holding([{ url: fake.url }])
    const started = localProvider.start('hello', cwd, { onStep: () => {} }, { address: fake.url, model: 'far/model' })
    await started.done
    expect(fake.asked.map(one => one.path)).toContain('/v1/chat/completions')
    expect(fake.asked.some(one => one.path.includes('/v1/v1'))).toBe(false)
  })

  it('carries the key this machine holds, which the settings never do', async () => {
    fake = await fakeServer(true)
    holding([{ url: fake.url, key: KEY }])
    const started = localProvider.start('hello', cwd, { onStep: () => {} }, { address: fake.url, model: 'far/model' })
    await started.done
    expect(fake.asked.every(one => one.key === KEY)).toBe(true)
  })

  it('says the key is what is missing rather than that nothing answered', async () => {
    fake = await fakeServer(true)
    holding([])
    const answer = await checkServer({ url: fake.url })
    expect(answer).toEqual({ ok: false, why: 'That server wants a key.' })
  })

  it('says the key was turned away rather than asking for one again', async () => {
    fake = await fakeServer(true)
    holding([])
    const answer = await checkServer({ url: fake.url, key: 'sk-wrong' })
    expect(answer).toEqual({ ok: false, why: 'That server did not take the key.' })
  })

  it('names an address nobody answers at, and offers no way to start one somewhere else', async () => {
    fake = await fakeServer(false)
    const url = fake.url
    await fake.close()
    fake = null
    holding([{ url }])
    const started = localProvider.start('hello', cwd, { onStep: () => {} }, { address: url, model: 'far/model' })
    await expect(started.done).rejects.toThrow(/Nothing answered at 127\.0\.0\.1:\d+/)
    await expect(started.done).rejects.not.toThrow(/Start it/)
  })

  it('stands in the picker with its models, under the host it was written as', async () => {
    fake = await fakeServer(true)
    holding([{ url: fake.url, key: KEY }])
    const found = await findRuntimes()
    await refreshModels(found)
    const fields = localFields()
    const server = fields.find(field => field.key === 'address')
    expect(server?.free).toBe(true)
    expect(server?.options.map(option => option.value)).toContain(fake.url)
    expect(server?.options.map(option => option.label)).toContain(fake.url.replace('http://', '').replace('/v1', ''))
    expect(fields.find(field => field.key === 'model')?.options.map(option => option.value)).toContain('far/model')
  })
})
