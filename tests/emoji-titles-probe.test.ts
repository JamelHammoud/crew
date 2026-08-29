// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadAsk from '../src/renderer/src/components/ThreadAsk'
import ThreadRow from '../src/renderer/src/components/sidebar/ThreadRow'
import TasksPanel from '../src/renderer/src/components/TasksPanel'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'
import { useTasks } from '../src/renderer/src/state/tasks'
import type { CustomEmoji } from '../src/shared/customEmoji'
import type { SessionEvent, Todo } from '../src/shared/events'
import type { LiveThread } from '../src/shared/threads'

Element.prototype.getAnimations ??= () => []

const BASE = 'http://127.0.0.1:4321'
const PICTURE = `${BASE}/emoji/a.gif`
const HEART = '❤️'

const SHEET: CustomEmoji[] = [{ id: 'e1', name: 'shipit', file: 'a.gif', by: 'Jamel', ts: 1 }]

const live = (title: string): LiveThread => ({ id: 't1', title, working: false, preview: title })

const thread = (title: string): ThreadMeta => ({
  id: 't1',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  title,
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build'
})

const started = (title: string): SessionEvent => ({
  id: 's-t1',
  ts: 1,
  kind: 'thread.started',
  threadId: 't1',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  title,
  byName: 'Jamel'
})

const todo = (text: string): Todo => ({
  id: 'd1',
  text,
  createdBy: 'Jamel',
  ts: 1,
  checked: false
})

const seed = (state: Partial<Parameters<typeof useCrew.setState>[0]> = {}) =>
  useCrew.setState({ agents: [], emoji: SHEET, httpBase: BASE, ...state })

const pictures = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('img')].map(el => el.getAttribute('src') ?? '').filter(src => src === PICTURE)

const written = (root: HTMLElement): string[] => [...root.querySelectorAll('.sr-only')].map(el => el.textContent ?? '')

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useCrew.setState({ emoji: [], httpBase: '' })
})

describe('what somebody wrote, read back as pictures', () => {
  it('draws them on the line the thread header is about', () => {
    seed()
    const said = `put made with ${HEART} :shipit: in the About page`
    const { container } = render(createElement(ThreadAsk, { ask: said, whole: said, onJump: () => {} }))

    expect(pictures(container)).toHaveLength(1)
    expect(written(container)).toContain(HEART)
  })

  it('draws them on the row in the rail', () => {
    seed()
    const { container } = render(
      createElement(ThreadRow, {
        thread: live(`made with ${HEART} :shipit:`),
        open: false,
        here: true,
        placeKey: 'project:/tmp/one',
        onOpen: () => {},
        onOpenToRight: () => {}
      })
    )

    expect(pictures(container)).toHaveLength(1)
    expect(written(container)).toContain(HEART)
  })

  it('draws them on a task and on a todo in the Tasks panel', () => {
    const title = `@Bubbles made with ${HEART} :shipit:`
    seed({
      threads: { t1: thread(title) },
      threadPrompts: {},
      queues: {},
      steps: {},
      todos: [todo(`water the plants ${HEART} :shipit:`)],
      events: [started(title)]
    })
    useTasks.setState({ pinned: true, peeking: false })
    const { container } = render(createElement(TasksPanel, { onOpenThread: () => {}, onOpenThreadBeside: () => {} }))

    expect(pictures(container)).toHaveLength(2)
    expect(written(container).filter(text => text === HEART)).toHaveLength(2)
  })
})
