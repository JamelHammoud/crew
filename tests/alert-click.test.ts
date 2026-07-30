import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Posted {
  title: string
  body: string
  fire: (event: string) => void
}

const posted = vi.hoisted(() => [] as Posted[])

vi.mock('electron', () => {
  class Notification {
    static isSupported = () => true
    private listeners = new Map<string, Array<() => void>>()
    private entry: Posted
    constructor(options: { title: string; body: string }) {
      this.entry = {
        title: options.title,
        body: options.body,
        fire: (event: string) => {
          for (const listener of this.listeners.get(event) ?? []) listener()
        }
      }
    }
    on(event: string, listener: () => void): this {
      const list = this.listeners.get(event) ?? []
      list.push(listener)
      this.listeners.set(event, list)
      return this
    }
    show(): void {
      posted.push(this.entry)
    }
  }
  return { app: { setBadgeCount: () => {} }, Notification }
})

const { alertsStanding, showAlert } = await import('../src/main/alerts')

const alert = (title = 'Bubbles finished') => ({
  title,
  body: 'fix the notification',
  threadId: 't1',
  agentId: 'a1'
})

beforeEach(() => {
  for (const one of posted) one.fire('close')
  posted.length = 0
})

describe('a finished notification', () => {
  it('is held until it is clicked, so the click still opens the thread', () => {
    const opened: string[] = []
    showAlert(alert(), () => opened.push('t1'))
    expect(alertsStanding()).toBe(1)
    posted[0]?.fire('click')
    expect(opened).toEqual(['t1'])
    expect(alertsStanding()).toBe(0)
  })

  it('is let go when it is swiped away', () => {
    const opened: string[] = []
    showAlert(alert(), () => opened.push('t1'))
    posted[0]?.fire('close')
    expect(alertsStanding()).toBe(0)
    expect(opened).toEqual([])
  })

  it('never piles up, and the newest is always the one still standing', () => {
    const opened: string[] = []
    for (let i = 0; i < 80; i += 1) showAlert(alert(`Bubbles finished ${i}`), () => opened.push(`t${i}`))
    expect(alertsStanding()).toBeLessThanOrEqual(32)
    posted[posted.length - 1]?.fire('click')
    expect(opened).toEqual(['t79'])
  })
})
