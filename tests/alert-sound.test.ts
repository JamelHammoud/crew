import { describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '../src/shared/events'

const shown = vi.hoisted(() => [] as Array<Record<string, unknown>>)

vi.mock('electron', () => ({
  app: { setBadgeCount: () => {} },
  Notification: class {
    static isSupported = () => true
    constructor(options: Record<string, unknown>) {
      shown.push(options)
    }
    on() {}
    show() {}
  }
}))

const { showAlert } = await import('../src/main/alerts')
const { soundFor } = await import('../src/renderer/src/media/sounds')

const ended: SessionEvent = {
  id: 'e1',
  ts: 1,
  kind: 'agent.end',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  ok: true,
  threadId: 't1'
}

describe('the sound a banner makes', () => {
  it('leaves the system tone off, so only crew is heard', () => {
    showAlert({ title: 'Bubbles finished', body: 'fix the sync loop', threadId: 't1' }, () => {})
    expect(shown).toHaveLength(1)
    expect(shown[0].silent).toBe(true)
  })

  it('still has a cue of its own for the event behind the banner', () => {
    expect(soundFor(ended, 'jamel', { threads: {}, threadPrompts: {}, queues: {} })).toBe('done')
  })
})
