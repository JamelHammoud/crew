// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'
import type { ThreadMeta } from '../src/renderer/src/state/store'

// Nothing in here has a width, so the one box that has to be measured is
// written on by hand and its own observer is the thing that reads it again.
const watchers: Array<{ el: Element; run: () => void }> = []

class TestResizeObserver {
  constructor(private readonly run: () => void) {}
  observe(el: Element): void {
    watchers.push({ el, run: this.run })
  }
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const resized = (el: Element) =>
  act(() => {
    for (const watcher of watchers) if (watcher.el === el) watcher.run()
  })

const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useCrew } = await import('../src/renderer/src/state/store')
const ThreadView = (await import('../src/renderer/src/views/ThreadView')).default

const THREAD = 't1'

const WHOLE = [
  '@Bubbles the composer header only has one line for this,',
  'and the rest of what was asked for is written under it,',
  'which is the part nobody can read without going to the top.'
].join('\n')

const agent: PooledAgent = {
  id: 'agent-1',
  label: 'Bubbles',
  provider: 'claude',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const message = (text: string): SessionEvent => ({
  id: 'm1',
  ts: 1000,
  kind: 'message',
  authorId: 'jamel',
  authorName: 'Jamel',
  text,
  mentions: ['agent-1'],
  mentionRefs: [{ id: 'agent-1', label: 'Bubbles' }],
  threadId: THREAD
})

const thread = (title: string): ThreadMeta => ({
  id: THREAD,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title,
  titleRefs: [{ id: 'agent-1', label: 'Bubbles' }],
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build'
})

const open = (title: string, text: string) => {
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useCrew.setState({
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [agent],
    threads: { [THREAD]: thread(title) },
    openThreadId: THREAD,
    events: [message(text)],
    steps: {},
    threadPrompts: {},
    threadDrafts: {},
    threadCommands: {},
    queues: {},
    pending: {}
  })
  return render(createElement(ThreadView, { threadId: THREAD }))
}

const askLine = (container: HTMLElement): HTMLElement =>
  [...container.querySelectorAll('button')].find(el =>
    (el.textContent ?? '').startsWith('the composer header')
  ) as HTMLElement

// The card stands off the box the ask is drawn in, and it opens on its own
// clock, so both are wound by hand in here.
const hover = (line: HTMLElement) => {
  fireEvent.mouseEnter(line.parentElement as HTMLElement)
  act(() => {
    vi.advanceTimersByTime(400)
  })
}

const card = (): HTMLElement | null => document.querySelector('.glass.fixed')

beforeEach(() => {
  watchers.length = 0
  vi.useFakeTimers()
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the whole of what a thread was asked, off its own header', () => {
  it('stands the message up in full without going to the head of the thread', () => {
    const { container } = open('@Bubbles the composer header only has one line for this,…', WHOLE)

    hover(askLine(container))

    const shown = card()
    expect(shown).not.toBeNull()
    expect(shown?.textContent).toContain('which is the part nobody can read')
  })

  // The line above it is one line of the message. Read as the message, the
  // rest of it would be missing from the one place it is meant to be whole.
  it('keeps the message as it was written, over the lines it was written in', () => {
    const { container } = open('@Bubbles the composer header only has one line for this,…', WHOLE)

    hover(askLine(container))

    expect(card()?.textContent).toContain('\n')
  })

  // The one line the header holds is as wide as the header, and a message that
  // fits neither the title nor the box is the case this was asked for.
  it('stands up for a line cut off in its own box', () => {
    const one = 'the composer header holds one line of this and cuts the rest off in the box'
    const { container } = open(`@Bubbles ${one}`, `@Bubbles ${one}`)
    const line = askLine(container)
    Object.defineProperty(line, 'scrollWidth', { value: 640, configurable: true })
    Object.defineProperty(line, 'clientWidth', { value: 220, configurable: true })

    resized(line)
    hover(askLine(container))

    expect(card()?.textContent).toContain(one)
  })

  // A card that says what the line already says is a card earning nothing.
  it('says nothing where the whole of it is already on the line', () => {
    const { container } = open(
      '@Bubbles the composer header fits this one',
      '@Bubbles the composer header fits this one'
    )

    fireEvent.mouseEnter(
      (
        [...container.querySelectorAll('button')].find(el =>
          (el.textContent ?? '').startsWith('the composer header')
        ) as HTMLElement
      ).parentElement as HTMLElement
    )
    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(card()).toBeNull()
  })

  // A card that holds more than it can show is scrolled inside itself, and one
  // that went down on the first turn of the wheel could never be read to the end.
  it('is not taken down by being scrolled', () => {
    const { container } = open('@Bubbles the composer header only has one line for this,…', WHOLE)
    hover(askLine(container))
    const shown = card() as HTMLElement

    fireEvent.scroll(shown.firstElementChild as HTMLElement)

    expect(card()).not.toBeNull()
  })

  it('stands while the thread scrolls under it, since the line it hangs off has not moved', () => {
    const { container } = open('@Bubbles the composer header only has one line for this,…', WHOLE)
    hover(askLine(container))

    fireEvent.scroll(container.querySelector('.overflow-y-auto') as HTMLElement)

    expect(card()).not.toBeNull()
  })

  it('goes when the box the line stands in is the one that moved', () => {
    const { container } = open('@Bubbles the composer header only has one line for this,…', WHOLE)
    const line = askLine(container)
    hover(line)

    fireEvent.scroll(line.closest('div') as HTMLElement)

    expect(card()).toBeNull()
  })
})
