import { execFile } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { AppSession } from '../src/main/session'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { parseLink } from '../src/shared/link'
import type { ServerMessage } from '../src/shared/protocol'
import { initRepo } from './helpers/git'
import { TestUi, tmpDir, waitUntil } from './helpers/session'

const RUN = process.env.CREW_REAL_CLI === '1'

function welcomeOf(ui: TestUi): Extract<ServerMessage, { type: 'welcome' }> {
  const welcome = ui.messages.find(m => m.type === 'welcome')
  if (!welcome) throw new Error('no welcome message')
  return welcome as Extract<ServerMessage, { type: 'welcome' }>
}

async function gitLog(repo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['log', '--oneline'], { cwd: repo }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

describe.skipIf(!RUN)('real end to end (CREW_REAL_CLI=1)', () => {
  it(
    'hosts a session, chats with a real agent, and syncs state with git',
    async () => {
      const repo = tmpDir('e2e')
      await initRepo(repo)
      const app = new AppSession()
      const info = await app.startHost(repo, 'verify')
      const target = parseLink(info.link)
      const ui = await TestUi.connect(info.wsUrl, 'verify', target.code)

      const kimiId = agentId('verify', 'kimi')
      await waitUntil(
        () =>
          welcomeOf(ui).snapshot.agents.some(a => a.id === kimiId) ||
          ui.events.some(e => e.kind === 'agent.online' && e.agentId === kimiId),
        15000
      )

      ui.chat('Reply with exactly: crew-ok @Kimi', [kimiId])
      const end = (await ui.waitForEvent(e => e.kind === 'agent.end', 90000)) as Extract<
        SessionEvent,
        { kind: 'agent.end' }
      >
      expect(end.ok).toBe(true)
      expect(end.text).toContain('crew-ok')

      await waitUntil(() => gitLog(repo).then(log => log.includes('crew sync')).catch(() => false), 20000)

      ui.close()
      await app.leave()
    },
    120000
  )

  it(
    'steers a real claude run that is already in flight',
    async () => {
      const repo = tmpDir('e2e-steer')
      await initRepo(repo)
      const app = new AppSession()
      const info = await app.startHost(repo, 'verify')
      const target = parseLink(info.link)
      const ui = await TestUi.connect(info.wsUrl, 'verify', target.code)

      const claudeId = agentId('verify', 'claude')
      await waitUntil(
        () =>
          welcomeOf(ui).snapshot.agents.some(a => a.id === claudeId && a.steerable) ||
          ui.events.some(e => e.kind === 'agent.online' && e.agentId === claudeId),
        15000
      )

      // Long enough to still be running when the steer arrives.
      ui.chat(
        'Using the Bash tool, run these one at a time as separate calls: `echo step1`, `echo step2`, ' +
          '`echo step3`, `echo step4`, `echo step5`. Do not batch them. @Claude',
        [claudeId]
      )
      const start = (await ui.waitForEvent(e => e.kind === 'agent.start', 30000)) as Extract<
        SessionEvent,
        { kind: 'agent.start' }
      >
      const thread = start.threadId!
      await ui.waitFor(msg => msg.type === 'agent.step' && msg.promptId === start.promptId, 60000)

      ui.chat('Change of plan: skip the remaining echo steps, run `echo pineapple` instead, then stop.', [], thread)
      const route = (await ui.waitForEvent(e => e.kind === 'message.route' && e.mode === 'steered', 30000)) as Extract<
        SessionEvent,
        { kind: 'message.route' }
      >
      expect(route.promptId).toBe(start.promptId)

      const end = (await ui.waitForEvent(e => e.kind === 'agent.end', 180000)) as Extract<
        SessionEvent,
        { kind: 'agent.end' }
      >
      expect(end.ok).toBe(true)
      expect(end.promptId).toBe(start.promptId)
      // The steer changed the course of the run it landed in, and no second run
      // was needed to answer it.
      expect(end.text?.toLowerCase()).toContain('pineapple')
      expect(ui.events.filter(e => e.kind === 'agent.start')).toHaveLength(1)

      ui.close()
      await app.leave()
    },
    240000
  )
})
