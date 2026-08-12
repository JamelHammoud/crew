import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fitWindow } from '../src/runner/providers/local-loop'
import { localFields, localProvider } from '../src/runner/providers/local'
import type { RunStep } from '../src/shared/llm'

type Frame = Record<string, unknown>

const line = (frame: Frame) => JSON.stringify(frame) + '\n'

const say = (content: string, extra: Frame = {}) =>
  line({ message: { role: 'assistant', content }, done: false, ...extra })

const think = (thinking: string) => line({ message: { role: 'assistant', content: '', thinking }, done: false })

const calls = (name: string, args: Record<string, unknown>) =>
  line({
    message: { role: 'assistant', content: '', tool_calls: [{ function: { name, arguments: args } }] },
    done: false
  })

const end = (counts: Frame = { prompt_eval_count: 120, eval_count: 44 }) =>
  line({ message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', ...counts })

const event = (delta: Frame) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`

const sseSay = (content: string) => event({ content })

const sseCalls = (name: string, args: Record<string, unknown>) =>
  event({
    tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }]
  })

const sseEnd = () => 'data: [DONE]\n\n'

interface Fake {
  url: string
  turns: string[][]
  asked: Array<Record<string, any>>
  hold: (round: number | null) => void
  close: () => Promise<void>
}

async function fakeRuntime(turns: string[][], kind: 'ollama' | 'openai' = 'ollama'): Promise<Fake> {
  const asked: Array<Record<string, any>> = []
  let heldFrom: number | null = null
  const ollama = kind === 'ollama'
  const server: Server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', async () => {
      if (ollama && req.url === '/api/tags') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ models: [{ name: 'thinker:8b', digest: 'sha256:one' }] }))
        return
      }
      if (ollama && req.url === '/api/show') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ capabilities: ['completion', 'tools', 'thinking'] }))
        return
      }
      if (!ollama && req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ data: [{ id: 'thinker:8b' }] }))
        return
      }
      if (req.url === (ollama ? '/api/chat' : '/v1/chat/completions')) {
        const parsed = JSON.parse(body || '{}')
        const at = asked.length
        asked.push(parsed)
        res.writeHead(200, { 'content-type': ollama ? 'application/x-ndjson' : 'text/event-stream' })
        for (const chunk of turns[at] ?? [ollama ? end() : sseEnd()]) {
          while (heldFrom !== null && at >= heldFrom) await new Promise(resolve => setTimeout(resolve, 5))
          res.write(chunk)
        }
        res.end()
        return
      }
      res.writeHead(404).end()
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    url: `http://127.0.0.1:${port}`,
    turns,
    asked,
    hold: (round: number | null) => {
      heldFrom = round
    },
    close: () => new Promise<void>(resolve => void server.close(() => resolve()))
  }
}

const waitFor = async (test: () => boolean, ms = 4000) => {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (test()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('That never happened.')
}

let fake: Fake | null = null
let cwd = ''
const wasHost = process.env.OLLAMA_HOST

const stand = async (turns: string[][], kind: 'ollama' | 'openai' = 'ollama') => {
  fake = await fakeRuntime(turns, kind)
  process.env.OLLAMA_HOST = fake.url
  cwd = mkdtempSync(join(tmpdir(), 'crew-local-'))
  expect(await localProvider.detect()).toBe(true)
  return fake
}

const run = (prompt: string, settings: Record<string, string> = {}) => {
  const steps: RunStep[] = []
  const counted: Array<{ tokens: number; cost: number | null }> = []
  const started = localProvider.start(
    prompt,
    cwd,
    { onStep: step => steps.push(step), onTokens: (tokens, cost) => counted.push({ tokens, cost }) },
    { address: fake!.url, model: 'thinker:8b', ...settings }
  )
  return { steps, counted, started }
}

afterEach(async () => {
  await fake?.close()
  fake = null
  if (wasHost === undefined) delete process.env.OLLAMA_HOST
  else process.env.OLLAMA_HOST = wasHost
})

describe('a local agent', () => {
  it('lists what the server really has once it has been looked for', async () => {
    await stand([])
    const fields = localFields()
    expect(fields.find(f => f.key === 'address')?.options?.map(o => o.value)).toContain(fake!.url)
    expect(fields.find(f => f.key === 'model')?.options?.map(o => o.value)).toContain('thinker:8b')
  })

  it('draws thinking, the answer and what it cost', async () => {
    await stand([[think('Working it out.'), say('All done.'), end()]])
    const { steps, counted, started } = run('say hello')
    expect((await started.done).text).toBe('All done.')
    expect(
      steps
        .filter(s => s.kind === 'thinking')
        .map(s => s.text)
        .join('')
    ).toBe('Working it out.')
    expect(
      steps
        .filter(s => s.kind === 'text')
        .map(s => s.text)
        .join('')
    ).toBe('All done.')
    expect(counted.at(-1)?.tokens).toBe(44)
  })

  it('draws no price for a model on your own machine', async () => {
    await stand([[say('Done.'), end()]])
    const { counted, started } = run('hello')
    await started.done
    expect(counted.every(entry => entry.cost === null)).toBe(true)
  })

  it('runs the tool it was asked for, and the file really changes', async () => {
    const target = join(cwd || tmpdir(), 'notes.md')
    await stand([
      [calls('Write', { file_path: 'notes.md', content: 'hello\n' }), end()],
      [say('Written.'), end()]
    ])
    const { steps, started } = run('write notes.md')
    expect((await started.done).text).toBe('Written.')
    expect(readFileSync(join(cwd, 'notes.md'), 'utf8')).toBe('hello\n')
    void target
    const tool = steps.filter(s => s.kind === 'tool')
    expect(tool[0].name).toBe('Write')
    expect(tool.at(-1)?.status).toBe('done')
  })

  it('carries a real diff on the step, off the arguments alone', async () => {
    await stand([
      [calls('Write', { file_path: 'a.txt', content: 'one\ntwo\n' }), end()],
      [say('Done.'), end()]
    ])
    const { steps, started } = run('write a.txt')
    await started.done
    const files = steps.find(s => s.files?.length)?.files
    expect(files?.[0]).toMatchObject({ path: 'a.txt', added: 3, removed: 0 })
    expect(files?.[0].diff).toContain('+ one')
  })

  it('keeps what a command printed and throws away what a file read said', async () => {
    await stand([
      [calls('Bash', { command: 'echo crew' }), end()],
      [calls('Read', { file_path: 'read-me.txt' }), end()],
      [say('Done.'), end()]
    ])
    writeFileSync(join(cwd, 'read-me.txt'), 'secret lines\n')
    const { steps, started } = run('run and read')
    await started.done
    const bash = steps.filter(s => s.name === 'Bash')
    const read = steps.filter(s => s.name === 'Read')
    expect(bash.at(-1)?.output).toContain('crew')
    expect(read.at(-1)?.output).toBeUndefined()
  })

  it('hands the result of a tool back to the model', async () => {
    await stand([
      [calls('Bash', { command: 'echo pebble' }), end()],
      [say('Saw it.'), end()]
    ])
    const { started } = run('run it')
    await started.done
    const second = fake!.asked[1]
    const result = second.messages.find((m: any) => m.role === 'tool')
    expect(result.content).toContain('pebble')
    expect(second.messages.some((m: any) => m.role === 'assistant' && m.tool_calls?.length)).toBe(true)
  })

  it('gives Ollama a call back as the object it takes, and names the tool that answered', async () => {
    await stand([
      [calls('Bash', { command: 'echo pebble' }), end()],
      [say('Saw it.'), end()]
    ])
    const { started } = run('run it')
    await started.done
    const sent = fake!.asked[1].messages
    expect(sent.find((m: any) => m.tool_calls?.length).tool_calls[0].function.arguments).toEqual({
      command: 'echo pebble'
    })
    expect(sent.find((m: any) => m.role === 'tool').tool_name).toBe('Bash')
  })

  it('gives an OpenAI compatible server the same call as the string its own spec asks for', async () => {
    await stand(
      [
        [sseCalls('Bash', { command: 'echo pebble' }), sseEnd()],
        [sseSay('Saw it.'), sseEnd()]
      ],
      'openai'
    )
    const { started } = run('run it')
    expect((await started.done).text).toBe('Saw it.')
    const sent = fake!.asked[1].messages
    expect(sent.find((m: any) => m.tool_calls?.length).tool_calls[0].function.arguments).toBe(
      '{"command":"echo pebble"}'
    )
    expect(sent.find((m: any) => m.role === 'tool').name).toBe('Bash')
  })

  it('takes a steer between one round and the next', async () => {
    await stand([
      [calls('Bash', { command: 'echo one' }), end()],
      [say('Heard you.'), end()]
    ])
    fake!.hold(0)
    const { started } = run('do it')
    await waitFor(() => fake!.asked.length >= 1)
    expect(started.steer!('actually stop at one')).toBe(true)
    fake!.hold(null)
    await started.done
    const second = fake!.asked[1]
    expect(second.messages.some((m: any) => m.role === 'user' && m.content === 'actually stop at one')).toBe(true)
  })

  it('stops when it is stopped, and keeps what was already done', async () => {
    await stand([
      [calls('Write', { file_path: 'kept.txt', content: 'kept\n' }), end()],
      [say('Carried on.'), end()]
    ])
    fake!.hold(1)
    const { started } = run('write it')
    await waitFor(() => fake!.asked.length >= 2)
    started.kill()
    await expect(started.done).rejects.toThrow()
    fake!.hold(null)
    expect(readFileSync(join(cwd, 'kept.txt'), 'utf8')).toBe('kept\n')
  })

  it('says so rather than hanging when the server answers nothing', async () => {
    await stand([])
    await fake!.close()
    delete process.env.OLLAMA_HOST
    const { started } = run('hello')
    await expect(started.done).rejects.toThrow(/Nothing answered at/)
  })

  it('keeps going toward the goal it was given, with the whole ask still in front of it', async () => {
    await stand([[say('Here is how.'), end()]])
    const steps: RunStep[] = []
    const started = localProvider.start(
      'You are an agent here.\n\nship the thing',
      cwd,
      { onStep: step => steps.push(step) },
      { address: fake!.url, model: 'thinker:8b' },
      { goal: 'ship the thing' }
    )
    await started.done
    const asked = String(fake!.asked[0].messages[1].content)
    expect(asked).toMatch(/keep working until/i)
    expect(asked).toContain('ship the thing')
    expect(asked).toContain('You are an agent here.')
    expect(asked).not.toMatch(/change nothing/i)
  })
})

describe('fitting the conversation into the window', () => {
  const message = (role: 'system' | 'user' | 'assistant' | 'tool', content: string) => ({ role, content })

  it('keeps the brief and the ask, whatever else has to go', () => {
    const long = 'x'.repeat(40000)
    const kept = fitWindow(
      [
        message('system', 'brief'),
        message('user', 'the ask'),
        message('assistant', long),
        message('tool', long),
        message('assistant', 'last'),
        message('tool', 'result')
      ],
      8192
    )
    expect(kept[0].content).toBe('brief')
    expect(kept[1].content).toBe('the ask')
    expect(kept.some(m => m.content === long)).toBe(false)
  })

  it('never leaves a result standing with no call in front of it', () => {
    const long = 'y'.repeat(40000)
    const kept = fitWindow(
      [
        message('system', 'brief'),
        message('user', 'the ask'),
        message('assistant', long),
        message('tool', long),
        message('tool', long),
        message('assistant', 'last'),
        message('tool', 'small')
      ],
      8192
    )
    const first = kept.slice(2)[0]
    expect(first?.role).not.toBe('tool')
  })

  it('leaves a conversation that fits exactly as it was', () => {
    const messages = [message('system', 'brief'), message('user', 'ask'), message('assistant', 'short')]
    expect(fitWindow(messages, 32768)).toEqual(messages)
  })
})
