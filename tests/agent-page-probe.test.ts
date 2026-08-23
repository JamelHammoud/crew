// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PageRow from '../src/renderer/src/components/PageRow'
import { openShown } from '../src/renderer/src/components/openShown'
import ThreadItems from '../src/renderer/src/components/ThreadItems'
import { buildThread } from '../src/renderer/src/components/thread'
import { useBrowser } from '../src/renderer/src/state/browser'
import type { SessionEvent } from '../src/shared/events'
import type { PathLocation } from '../src/shared/files'

// What an agent shows and what the app opens are two different answers. A file
// belongs in the file view, where it is lit, drawn or diffed, and only an
// address belongs in the browser: opened as a raw file:// tab, everything that
// is not a page came out as text nobody could read.

const REPO = '/Users/sam/project'

const located: Record<string, PathLocation> = {}

beforeEach(() => {
  for (const key of Object.keys(located)) delete located[key]
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
  vi.stubGlobal('crew', {
    locatePath: (path: string): Promise<PathLocation> => Promise.resolve(located[path] ?? { kind: 'private' })
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const inRepo = (path: string, name: string): void => {
  located[path] = { kind: 'repo', path: name, exists: true }
}

const shownEvent = (extra: Record<string, unknown>): SessionEvent =>
  ({
    id: 'p1',
    ts: 1,
    kind: 'page.shown',
    threadId: 't1',
    title: 'What I changed',
    agentId: 'a1',
    agentLabel: 'Bubbles',
    ...extra
  }) as SessionEvent

describe('what a shown file opens in', () => {
  it('opens a file in the file view and an address in the browser', async () => {
    inRepo(`${REPO}/theme.css`, 'theme.css')
    inRepo(`${REPO}/Button.tsx`, 'Button.tsx')

    await openShown([`file://${REPO}/theme.css`, `file://${REPO}/Button.tsx`, 'http://localhost:5173'])

    const tabs = useBrowser.getState().tabs
    // They stand in the order they were named.
    expect(tabs.filter(tab => tab.kind === 'file').map(tab => tab.path)).toEqual(['theme.css', 'Button.tsx'])
    expect(tabs.filter(tab => tab.kind === 'web').map(tab => tab.url)).toEqual(['http://localhost:5173'])
    // Showing something stands the panel up, and the first one named is the one
    // being read.
    expect(useBrowser.getState().open).toBe(true)
    const front = tabs.find(tab => tab.id === useBrowser.getState().activeTabId)
    expect(front?.path).toBe('theme.css')
  })

  it('leaves a file nobody here can follow alone', async () => {
    await openShown(['file:///Users/ali/elsewhere/notes.md'])
    expect(useBrowser.getState().tabs).toHaveLength(0)
    expect(useBrowser.getState().open).toBe(false)

    // One named first that nobody here can follow leaves the front to whatever
    // really opened, rather than to nothing.
    inRepo(`${REPO}/notes.md`, 'notes.md')
    await openShown(['file:///Users/ali/elsewhere/notes.md', `file://${REPO}/notes.md`])
    const { tabs, activeTabId } = useBrowser.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs.find(tab => tab.id === activeTabId)?.path).toBe('notes.md')
  })
})

describe('the row a showing leaves behind', () => {
  it('reads as a step, and folds several into one row that opens', async () => {
    const pages = [`file://${REPO}/theme.css`, `file://${REPO}/Button.tsx`]
    render(createElement(PageRow, { shown: { pages, title: 'What I changed' } }))

    expect(screen.getByText('Showed')).toBeTruthy()
    expect(screen.getByText('What I changed')).toBeTruthy()
    expect(screen.getByText('2 files')).toBeTruthy()
    expect(screen.queryByText('theme.css')).toBeNull()

    screen.getByRole('button').click()
    expect(await screen.findByText('theme.css')).toBeTruthy()
    expect(screen.getByText('Button.tsx')).toBeTruthy()
  })

  it('names one page once, however it was written down', () => {
    const one = buildThread([shownEvent({ pages: ['http://localhost:5173'] })], {}, 'sam')
    expect(one.find(item => item.kind === 'page')?.shown?.pages).toEqual(['http://localhost:5173'])

    // A crew that showed a page before a call could name several wrote one url,
    // and that row still stands.
    const old = buildThread([shownEvent({ url: 'file:///Users/sam/site/index.html' })], {}, 'sam')
    expect(old.find(item => item.kind === 'page')?.shown?.pages).toEqual(['file:///Users/sam/site/index.html'])
  })
})

describe('the mark a showing wears', () => {
  const drawn = (pages: string[]): { tile: string | null; cut: string | null; painted: number } => {
    const { container } = render(createElement(PageRow, { shown: { pages, title: 'Look at this' } }))
    const mark = container.querySelector('mask')?.closest('svg') ?? null
    return {
      tile: mark?.querySelector('rect[fill="currentColor"]')?.getAttribute('width') ?? null,
      cut: mark?.querySelector('mask path')?.getAttribute('d') ?? null,
      painted: mark ? mark.querySelectorAll(':scope > path').length : -1
    }
  }

  it('is the one tile, whether it showed a file, several, or an address', () => {
    const file = drawn([`file://${REPO}/index.html`])
    const several = drawn([`file://${REPO}/a.css`, `file://${REPO}/b.css`, `file://${REPO}/c.css`])
    const address = drawn(['http://localhost:5173'])

    expect(file.tile).toBe('17.5')
    expect(several).toEqual(file)
    expect(address).toEqual(file)
  })

  it('cuts the arrow out rather than painting it, so the row shows through', () => {
    const one = drawn([`file://${REPO}/index.html`])
    expect(one.cut).toContain('M')
    expect(one.painted).toBe(0)
  })
})

const RUN = 'p9'

const ranEvent = (ts: number): SessionEvent =>
  ({
    id: `start-${ts}`,
    ts,
    kind: 'agent.start',
    promptId: RUN,
    agentId: 'a1',
    agentLabel: 'Bubbles',
    promptText: 'show me',
    byName: 'Bubbles',
    threadId: 't1'
  }) as SessionEvent

const thought = {
  [RUN]: [{ id: 's1', ts: 1, kind: 'thinking' as const, status: 'done' as const, text: 'weighing it' }]
}

const alsoRead = {
  [RUN]: [
    ...thought[RUN],
    { id: 's2', ts: 3, kind: 'tool' as const, status: 'done' as const, name: 'Read', detail: 'notes.md' }
  ]
}

const endedEvent = (ts: number): SessionEvent =>
  ({
    id: `end-${ts}`,
    ts,
    kind: 'agent.end',
    promptId: RUN,
    agentId: 'a1',
    agentLabel: 'Bubbles',
    ok: true,
    text: '',
    threadId: 't1'
  }) as SessionEvent

describe('where a page row sits in the run that showed it', () => {
  const rowOf = (word: string): HTMLElement | null => screen.getByText(word).closest('div')

  it('closes up against the steps either side of it', () => {
    const events = [ranEvent(1), shownEvent({ ts: 2, promptId: RUN, pages: ['http://localhost:5173'] })]
    render(createElement(ThreadItems, { items: buildThread(events, alsoRead, 'sam'), threadId: 't1' }))

    expect(rowOf('Thought')?.className).not.toContain('-mt-3')
    expect(rowOf('Showed')?.className).toContain('-mt-3')
    expect(rowOf('Read')?.className).toContain('-mt-3')
  })

  it('stands clear of a run that is not its own', () => {
    const events = [ranEvent(1), shownEvent({ ts: 2, promptId: 'other', pages: ['http://localhost:5173'] })]
    render(createElement(ThreadItems, { items: buildThread(events, thought, 'sam'), threadId: 't1' }))
    expect(rowOf('Showed')?.className).not.toContain('-mt-3')
  })

  it('reads the run off the log for a page shown before it was written down', () => {
    const events = [ranEvent(1), shownEvent({ ts: 2, pages: ['http://localhost:5173'] })]
    render(createElement(ThreadItems, { items: buildThread(events, alsoRead, 'sam'), threadId: 't1' }))

    expect(rowOf('Showed')?.className).toContain('-mt-3')
    expect(rowOf('Read')?.className).toContain('-mt-3')
  })

  it('stands clear where no run was open to have shown it', () => {
    const events = [ranEvent(1), endedEvent(2), shownEvent({ ts: 3, pages: ['http://localhost:5173'] })]
    render(createElement(ThreadItems, { items: buildThread(events, thought, 'sam'), threadId: 't1' }))
    expect(rowOf('Showed')?.className).not.toContain('-mt-3')
  })
})
