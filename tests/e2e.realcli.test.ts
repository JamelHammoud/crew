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
})
