import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

const fake = agentId('jamel', 'fake')

describe('the removed iPhone simulator', () => {
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
    await host.close()
  })

  it('does not add simulator instructions when the project contains an Xcode project', async () => {
    await mkdir(path.join(host.repoPath, 'App.xcodeproj'))
    runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_ECHO_PROMPT: '1' })],
      reconnectDelayMs: 100
    })
    ui = await TestUi.connect(host.url, 'ali', host.code)
    runner.connect(host.url)
    await ui.waitForEvent(event => event.kind === 'agent.online' && event.agentId === fake)

    ui.chat('Build the app', [fake])
    const ended = (await ui.waitForEvent(event => event.kind === 'agent.end')) as Ended

    expect(ended.text).not.toContain('The iPhone app')
    expect(ended.text).not.toContain('xcodebuild')
    expect(ended.text).not.toContain('/ios')
  })

  it('does not expose an iOS action route', async () => {
    const response = await fetch(`${base}/ios`, { method: 'POST' })
    expect(response.status).toBe(404)
  })
})
