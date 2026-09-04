import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { iosBuildLog } from '../src/shared/iosAgent'
import { agentId } from '../src/shared/llm'
import type { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>
type Ran = Extract<SessionEvent, { kind: 'ios.ran' }>

const fake = agentId('jamel', 'fake')

describe('a folder that builds an iPhone app', () => {
  let host: TestHost
  let runner: Runner | null = null
  let ui: TestUi | null = null
  let base = ''

  beforeEach(async () => {
    host = await startHost()
    base = host.url.replace('ws://', 'http://').replace('/ws', '')
  })

  afterEach(async () => {
    ui?.close()
    runner?.close()
    ui = null
    runner = null
    await host.close()
  })

  const project = () => mkdir(path.join(host.repoPath, 'App.xcodeproj'), { recursive: true })

  async function join(env: Record<string, string> = { FAKE_CLI_ECHO_PROMPT: '1' }): Promise<TestUi> {
    runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider(env)],
      reconnectDelayMs: 100
    })
    const seat = await TestUi.connect(host.url, 'ali', host.code)
    runner.connect(host.url)
    await seat.waitForEvent(event => event.kind === 'agent.online' && event.agentId === fake)
    return seat
  }

  const post = (body: unknown): Promise<number> =>
    fetch(`${base}/ios`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(res => res.status)

  it('tells the agent about the simulator without anybody asking for it', async () => {
    await project()
    ui = await join()
    ui.chat('Build the onboarding flow', [fake])
    const said = (await ui.waitForEvent(event => event.kind === 'agent.end')) as Ended
    expect(said.text).toContain('The iPhone app')
    expect(said.text).toContain(iosBuildLog(host.repoPath))
    expect(said.text).toContain('Never run xcodebuild')
  })

  it('says nothing about it in a folder with no app in it', async () => {
    ui = await join()
    ui.chat('Just a normal message', [fake])
    const said = (await ui.waitForEvent(event => event.kind === 'agent.end')) as Ended
    expect(said.text).not.toContain('The iPhone app')
  })

  it('puts the app on the screen from the run that asked', async () => {
    await project()
    ui = await join({ FAKE_CLI_DELAY_MS: '1500' })
    ui.chat('Build the onboarding flow', [fake])
    const run = (await ui.waitForEvent(event => event.kind === 'agent.start')) as Start
    expect(await post({ promptId: run.promptId })).toBe(200)
    const ran = (await ui.waitForEvent(event => event.kind === 'ios.ran')) as Ran
    expect(ran.threadId).toBe(run.threadId)
    expect(ran.agentId).toBe(fake)
  })

  it('turns away a call from a run that is not going', async () => {
    ui = await join()
    expect(await post({ promptId: 'nobody' })).toBe(400)
  })
})
