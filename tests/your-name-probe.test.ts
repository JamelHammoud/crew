// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage } from '../src/shared/protocol'
import { installLocalStorage } from './helpers/local-storage'

const sent: ClientMessage[] = []

vi.mock('../src/renderer/src/api/ws', () => ({
  CrewSocket: class {
    send(msg: ClientMessage) {
      sent.push(msg)
    }
    connect() {}
    close() {}
    onMessage() {}
  }
}))

const storage = installLocalStorage()
const { useCrew } = await import('../src/renderer/src/state/store')

describe('the name you go by', () => {
  beforeEach(() => {
    sent.length = 0
    storage.clear()
    storage.setItem('crew.name', 'Jamel')
    window.crew = { rename: vi.fn().mockResolvedValue(null) } as unknown as CrewBridge
    useCrew.setState({ selfId: 'jamel', selfName: 'Jamel', connection: 'online' })
  })

  it('follows a rename to the next place you open', () => {
    expect(useCrew.getState().renameSelf('Jamel (dev)')).toBe(true)

    expect(useCrew.getState().selfName).toBe('Jamel (dev)')
    expect(storage.getItem('crew.name')).toBe('Jamel (dev)')
    expect(sent).toContainEqual({ type: 'member.rename', name: 'Jamel (dev)' })
    expect(window.crew.rename).toHaveBeenCalledWith('Jamel (dev)')
  })

  it('leaves the name where it is when nothing was really asked for', () => {
    expect(useCrew.getState().renameSelf('  Jamel  ')).toBe(false)
    expect(useCrew.getState().renameSelf('   ')).toBe(false)

    expect(storage.getItem('crew.name')).toBe('Jamel')
    expect(sent).toHaveLength(0)
  })
})
