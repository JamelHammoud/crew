import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { describe, expect, it } from 'vitest'
import { makeCliProvider } from '../src/runner/providers/cli'
import { createCrewServer } from '../src/server/index'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import { agentId } from '../src/shared/llm'
import { parseFakeLine } from './helpers/fake-provider'
import { TestUi, tmpDir, waitUntil } from './helpers/session'

const lingeringCliPath = fileURLToPath(new URL('./helpers/fake-lingering-cli.mjs', import.meta.url))

function lingeringProvider(env: NodeJS.ProcessEnv = {}) {
  return makeCliProvider({
    name: 'linger',
    label: 'Linger',
    command: process.execPath,
    args: () => [lingeringCliPath],
    parser: parseFakeLine,
    env
  })
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe('runs that would stick on Working', () => {
  it('finishes when the CLI exits but a grandchild holds its pipes open', async () => {
    const repo = tmpDir('linger')
    const run = lingeringProvider().start('go', repo, { onStep: () => {} })
    const { text } = await run.done
    expect(text).toMatch(/^\d+$/)
  }, 15000)

  it('kill stops the whole process tree and settles the run', async () => {
    const repo = tmpDir('linger-kill')
    let pidText = ''
    const run = lingeringProvider({ FAKE_LINGER_STAY: '1' }).start('go', repo, {
      onStep: step => {
        if (step.kind === 'text' && step.text) pidText += step.text
      }
    })
    await waitUntil(() => pidText.trim().length > 0)
    run.kill()
    await expect(run.done).rejects.toThrow('Stopped')
    const pid = Number(pidText.trim())
    await waitUntil(() => !alive(pid))
  }, 20000)

  it('closes runs orphaned by a restart when the session loads', () => {
    const dir = tmpDir('orphan')
    const store = new Store(dir)
    const promptId = randomUUID()
    store.appendEvent({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'thread.started',
      threadId: 't1',
      agentId: 'a1',
      agentLabel: 'Fake',
      title: 'stuck thread',
      byName: 'jamel'
    })
    store.appendEvent({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.start',
      promptId,
      agentId: 'a1',
      agentLabel: 'Fake',
      promptText: 'do the thing',
      byName: 'jamel',
      threadId: 't1'
    })
    const session = new CrewSession(store)
    const ends = session.snapshot().events.filter(e => e.kind === 'agent.end' && e.promptId === promptId)
    expect(ends).toHaveLength(1)
    expect(ends[0].kind === 'agent.end' && ends[0].ok).toBe(false)
    const reloaded = new CrewSession(new Store(dir))
    expect(reloaded.snapshot().events.filter(e => e.kind === 'agent.end' && e.promptId === promptId)).toHaveLength(1)
  })

  it('stop closes the run even when the runner never reports the kill', async () => {
    const session = new CrewSession(new Store(tmpDir('deaf')), { cancelTimeoutMs: 300 })
    const server = await createCrewServer(session, { port: 0, host: '127.0.0.1' })
    const url = `ws://127.0.0.1:${server.port()}/ws`
    const runner = new WebSocket(url)
    runner.on('open', () =>
      runner.send(
        JSON.stringify({
          type: 'hello',
          role: 'runner',
          name: 'mac',
          code: session.code,
          llms: [{ instanceId: 'fake', provider: 'fake', label: 'Fake', fields: [], settings: {} }]
        })
      )
    )
    const ui = await TestUi.connect(url, 'jamel', session.code)
    await waitUntil(() => session.snapshot().agents.length > 0)
    ui.chat('do the thing', [agentId('mac', 'fake')])
    const start = await ui.waitForEvent(e => e.kind === 'agent.start')
    if (start.kind !== 'agent.start') throw new Error('expected agent.start')
    ui.cancel(start.promptId)
    const end = await ui.waitForEvent(e => e.kind === 'agent.end')
    if (end.kind !== 'agent.end') throw new Error('expected agent.end')
    expect(end.ok).toBe(false)
    runner.close()
    ui.close()
    await server.close()
  }, 15000)
})
