import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { claudeDialog } from '../src/runner/providers/claude'
import type { Provider } from '../src/runner/providers/types'
import { GOAL_LIMIT, goalBrief, goalCondition } from '../src/shared/goal'
import { agentId } from '../src/shared/llm'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

describe('goal runs', () => {
  let host: TestHost
  let runner: Runner
  let ui: TestUi

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    ui?.close()
    runner?.close()
    await host.close()
  })

  it('starts a fresh goal run from chat or a live thread', async () => {
    const goals: (string | undefined)[] = []
    const prompts: string[] = []
    let steers = 0
    const provider: Provider = {
      name: 'watcher',
      label: 'Watcher',
      steerable: true,
      fields: () => [],
      detect: async () => true,
      start: (prompt, _cwd, _hooks, _settings, options) => {
        prompts.push(prompt)
        goals.push(options?.goal)
        return {
          done: new Promise(resolve => setTimeout(() => resolve({ text: 'done' }), 180)),
          kill: () => {},
          steer: () => {
            steers += 1
            return true
          }
        }
      }
    }
    ui = await TestUi.connect(host.url, 'sam', host.code)
    runner = testRunner({ name: 'sam', code: host.code, repoPath: host.repoPath, providers: [provider] })
    runner.connect(host.url)
    await ui.waitForEvent(event => event.kind === 'agent.online')

    const watcher = agentId('sam', 'watcher')
    ui.chat('start the migration @Watcher', [watcher])
    const thread = await ui.waitForEvent(event => event.kind === 'thread.started')
    if (thread.kind !== 'thread.started') throw new Error('The thread did not start.')
    await ui.waitForEvent(event => event.kind === 'agent.start' && event.threadId === thread.threadId)

    ui.chat('finish the migration', [], thread.threadId, ['goal'])
    const goalStart = await ui.waitForEvent(
      event =>
        event.kind === 'agent.start' &&
        event.threadId === thread.threadId &&
        event.promptText === 'finish the migration'
    )
    if (goalStart.kind !== 'agent.start') throw new Error('The goal run did not start.')
    await ui.waitForEvent(event => event.kind === 'agent.end' && event.promptId === goalStart.promptId)
    expect(goals).toEqual([undefined, 'finish the migration'])
    expect(steers).toBe(0)

    ui.chat('verify it @Watcher', [watcher], undefined, ['goal'])
    const chatGoal = await ui.waitForEvent(
      event =>
        event.kind === 'agent.start' && event.threadId !== thread.threadId && event.promptText === 'verify it @Watcher'
    )
    if (chatGoal.kind !== 'agent.start') throw new Error('The chat goal did not start.')
    await ui.waitForEvent(event => event.kind === 'agent.end' && event.promptId === chatGoal.promptId)
    expect(goals).toEqual([undefined, 'finish the migration', 'verify it @Watcher'])
  })

  it('holds the goal to what the person wrote, whatever the prompt around it grew to', async () => {
    let condition = ''
    let prompt = ''
    const provider: Provider = {
      name: 'watcher',
      label: 'Watcher',
      steerable: true,
      fields: () => [],
      detect: async () => true,
      start: (text, _cwd, _hooks, _settings, options) => {
        prompt = text
        condition = options?.goal ?? ''
        return { done: Promise.resolve({ text: 'done' }), kill: () => {} }
      }
    }
    ui = await TestUi.connect(host.url, 'sam', host.code)
    runner = testRunner({ name: 'sam', code: host.code, repoPath: host.repoPath, providers: [provider] })
    runner.connect(host.url)
    await ui.waitForEvent(event => event.kind === 'agent.online')

    const said = 'finish the migration and leave the tests green'
    ui.chat(`${said} @Watcher`, [agentId('sam', 'watcher')], undefined, ['goal'])
    const start = await ui.waitForEvent(event => event.kind === 'agent.start')
    if (start.kind !== 'agent.start') throw new Error('The goal run did not start.')
    await ui.waitForEvent(event => event.kind === 'agent.end' && event.promptId === start.promptId)

    expect(condition).toBe(`${said} @Watcher`)
    expect(condition.length).toBeLessThanOrEqual(GOAL_LIMIT)
    expect(prompt.length).toBeGreaterThan(condition.length)
    expect(condition).not.toContain('/agents/spawn')
  })

  it('sets the goal as a message of its own, so the prompt is never read as the condition', () => {
    const said = 'finish the migration'
    const prompt = `You are an agent here.\n\n${said}\n\n${'curl -s -X POST /agents/spawn '.repeat(200)}`
    const lines = claudeDialog(prompt, said)
      .begin()
      .map(line => JSON.parse(line).message.content[0].text)

    expect(lines).toEqual([`/goal ${said}`, prompt])
    expect(lines[0].length).toBeLessThanOrEqual(GOAL_LIMIT)
    expect(prompt.length).toBeGreaterThan(GOAL_LIMIT)
    expect(claudeDialog(prompt).begin()).toHaveLength(1)
  })

  it('cuts a condition longer than the CLI will take, and keeps the whole ask in the prompt', () => {
    const said = `${'work '.repeat(1200)}and stop`
    const condition = goalCondition(said)
    expect(said.length).toBeGreaterThan(GOAL_LIMIT)
    expect(condition.length).toBeLessThanOrEqual(GOAL_LIMIT)
    expect(condition.endsWith(' ')).toBe(false)
    expect(goalBrief(condition)).toContain(condition)
  })
})
