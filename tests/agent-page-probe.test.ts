// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PageRow from '../src/renderer/src/components/PageRow'
import { openShown } from '../src/renderer/src/components/openShown'
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
    locatePath: (path: string): Promise<PathLocation> =>
      Promise.resolve(located[path] ?? { kind: 'private' })
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

    await openShown([
      `file://${REPO}/theme.css`,
      `file://${REPO}/Button.tsx`,
      'http://localhost:5173'
    ])

    const tabs = useBrowser.getState().tabs
    expect(tabs.filter(tab => tab.kind === 'file').map(tab => tab.path)).toEqual([
      'Button.tsx',
      'theme.css'
    ])
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
    expect(old.find(item => item.kind === 'page')?.shown?.pages).toEqual([
      'file:///Users/sam/site/index.html'
    ])
  })
})
