// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { useBrowser } from '../src/renderer/src/state/browser'
import type { RepoFile } from '../src/shared/files'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

const repo: Record<string, RepoFile> = {
  '': {
    kind: 'dir',
    path: '',
    entries: [
      { name: 'src', dir: true },
      { name: 'tests', dir: true },
      { name: 'readme.md', dir: false }
    ]
  },
  src: {
    kind: 'dir',
    path: 'src',
    entries: [
      { name: 'renderer', dir: true },
      { name: 'app.ts', dir: false }
    ]
  },
  'src/renderer': { kind: 'dir', path: 'src/renderer', entries: [{ name: 'panel.tsx', dir: false }] },
  'src/app.ts': { kind: 'file', path: 'src/app.ts', text: 'export const one = 1\n', truncated: false },
  'src/renderer/panel.tsx': {
    kind: 'file',
    path: 'src/renderer/panel.tsx',
    text: 'export const panel = 2\n',
    truncated: false
  },
  tests: { kind: 'dir', path: 'tests', entries: [{ name: 'app.test.ts', dir: false }] },
  'readme.md': { kind: 'file', path: 'readme.md', text: 'hello\n', truncated: false }
}

const listed = ['readme.md', 'src/app.ts', 'src/renderer/panel.tsx', 'tests/app.test.ts']

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null })
  Element.prototype.scrollIntoView = () => undefined
  window.crew = {
    readFile: async (path: string) => repo[path] ?? { kind: 'missing', path },
    listFiles: async () => listed,
    writeFile: async () => null,
    revealFile: async () => undefined,
    openExternal: async () => undefined,
    warmTerminal: () => undefined
  } as unknown as CrewBridge
})

afterEach(() => cleanup())

const activeTab = () => {
  const { tabs, activeTabId } = useBrowser.getState()
  return tabs.find(tab => tab.id === activeTabId)!
}

const rowFor = (path: string) => document.querySelector(`[data-file="${path}"]`) as HTMLElement | null

describe('the file explorer', () => {
  it('opens on the project with the tree standing beside it', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))

    expect(activeTab().kind).toBe('file')
    expect(activeTab().tree).toBe(true)
    expect(await screen.findByText('src')).toBeTruthy()
    expect(screen.getByText('readme.md')).toBeTruthy()
    expect(screen.getByText('Pick a file from the project')).toBeTruthy()
  })

  it('never shows the tree and the folder listing at once', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('readme.md')

    expect(screen.getAllByText('readme.md').length).toBe(1)
  })

  it('opens a folder in place and closes it again', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))

    expect(await screen.findByText('app.ts')).toBeTruthy()
    expect(activeTab().open).toEqual(['src'])

    fireEvent.click(screen.getByText('src'))
    await waitFor(() => expect(screen.queryByText('app.ts')).toBeNull())
  })

  it('opens a nested folder without closing the one above it', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    fireEvent.click(await screen.findByText('renderer'))

    expect(await screen.findByText('panel.tsx')).toBeTruthy()
    expect(screen.getByText('app.ts')).toBeTruthy()
  })

  it('shows a file the moment it is picked, keeping the tree as it was', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    fireEvent.click(await screen.findByText('app.ts'))

    expect(activeTab().path).toBe('src/app.ts')
    expect(activeTab().open).toEqual(['src'])
    expect(await screen.findByText('export const one = 1')).toBeTruthy()
    expect(screen.getByText('renderer')).toBeTruthy()
  })

  it('filters the whole project rather than the folders that happen to be open', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.change(screen.getByLabelText('Filter files'), { target: { value: 'panel' } })

    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())
    expect(rowFor('readme.md')).toBeNull()
    expect(rowFor('src/renderer/panel.tsx')!.textContent).toContain('src/renderer')
  })

  it('picks out the letters that matched', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.change(screen.getByLabelText('Filter files'), { target: { value: 'pan' } })

    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())
    expect(rowFor('src/renderer/panel.tsx')!.querySelector('.text-fg')?.textContent).toBe('pan')
  })

  it('opens a file straight from the filter', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')
    fireEvent.change(screen.getByLabelText('Filter files'), { target: { value: 'panel' } })
    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())

    fireEvent.click(rowFor('src/renderer/panel.tsx')!)

    expect(activeTab().path).toBe('src/renderer/panel.tsx')
  })

  it('says so plainly when nothing matches', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.change(screen.getByLabelText('Filter files'), { target: { value: 'zzzz' } })

    expect(await screen.findByText('Nothing here by that name')).toBeTruthy()
  })

  it('puts the tree away and brings it back from the toolbar', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.click(screen.getByLabelText('Hide files'))
    await waitFor(() => expect(screen.queryByLabelText('Filter files')).toBeNull())
    expect(activeTab().tree).toBe(false)
    expect(await screen.findByText('readme.md')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Show files'))
    expect(await screen.findByLabelText('Filter files')).toBeTruthy()
  })

  it('leaves a file opened from a message without a tree', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))

    expect(activeTab().tree).toBe(false)
    expect(screen.queryByLabelText('Filter files')).toBeNull()
  })

  it('goes back to the explorer already open rather than piling up tabs', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    useBrowser.getState().addTab()

    useBrowser.getState().openFiles()

    expect(useBrowser.getState().tabs.filter(tab => tab.kind === 'file').length).toBe(1)
    expect(activeTab().path).toBe('src/app.ts')
    expect(activeTab().tree).toBe(true)
  })
})
