// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { FILE_DROP_EXPAND_MS, fileDropScrollSpeed } from '../src/renderer/src/components/FileTree'
import { useBrowser } from '../src/renderer/src/state/browser'
import type { RepoEntryCreateResult, RepoFile } from '../src/shared/files'
import type { FileReplaceRequest, FileSearchOptions } from '../src/shared/fileSearch'

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
const popOutBrowserTab = vi.fn().mockResolvedValue(true)
const createEntry = vi.fn(async (path: string): Promise<RepoEntryCreateResult> => ({ ok: true, path }))
const moveEntry = vi.fn(async (source: string, parent: string) => ({
  ok: true as const,
  path: parent ? `${parent}/${source.split('/').pop()}` : source.split('/').pop()!
}))
const replaceFiles = vi.fn().mockResolvedValue({ files: 1, replacements: 1, failed: [], error: null })
const searchFiles = vi.fn(async (options: FileSearchOptions) => ({
  matches:
    options.query.toLowerCase() === 'implementationdetail'
      ? [
          {
            path: 'src/renderer/panel.tsx',
            line: 7,
            column: 7,
            endColumn: 27,
            text: 'const implementationDetail = true',
            start: 6,
            end: 26
          }
        ]
      : [],
  limited: false,
  error: null
}))

beforeEach(() => {
  popOutBrowserTab.mockClear()
  createEntry.mockClear()
  createEntry.mockImplementation(async (path: string) => ({ ok: true as const, path }))
  moveEntry.mockClear()
  moveEntry.mockImplementation(async (source: string, parent: string) => ({
    ok: true as const,
    path: parent ? `${parent}/${source.split('/').pop()}` : source.split('/').pop()!
  }))
  replaceFiles.mockClear()
  searchFiles.mockClear()
  useBrowser.setState({ tabs: [], activeTabId: null })
  Element.prototype.scrollIntoView = () => undefined
  Range.prototype.getBoundingClientRect = () =>
    ({ left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) })
  window.crew = {
    readFile: async (path: string) => repo[path] ?? { kind: 'missing', path },
    listFiles: async () => listed,
    createEntry,
    moveEntry,
    searchFiles,
    replaceFiles,
    writeFile: async () => null,
    revealFile: async () => undefined,
    openExternal: async () => undefined,
    popOutBrowserTab,
    warmTerminal: () => undefined
  } as unknown as CrewBridge
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const activeTab = () => {
  const { tabs, activeTabId } = useBrowser.getState()
  return tabs.find(tab => tab.id === activeTabId)!
}

const rowFor = (path: string) => document.querySelector(`[data-file="${path}"]`) as HTMLElement | null

const transfer = () => ({
  effectAllowed: 'none',
  dropEffect: 'none',
  setData: vi.fn(),
  getData: vi.fn(() => ''),
  types: []
})

describe('file drag scrolling', () => {
  it('accelerates toward either edge and stops through the middle', () => {
    expect(fileDropScrollSpeed(100, 100, 500)).toBe(-32)
    expect(fileDropScrollSpeed(142, 100, 500)).toBe(-16)
    expect(fileDropScrollSpeed(300, 100, 500)).toBe(0)
    expect(fileDropScrollSpeed(458, 100, 500)).toBe(16)
    expect(fileDropScrollSpeed(500, 100, 500)).toBe(32)
  })
})

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

  it('creates a file from the visible Files actions and opens it', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    expect(screen.getByLabelText('New file')).toBeTruthy()
    expect(screen.getByLabelText('New folder')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('New file'))
    const input = screen.getByLabelText('New file name')
    fireEvent.change(input, { target: { value: 'notes.md' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(createEntry).toHaveBeenCalledWith('notes.md', 'file'))
    expect(activeTab().path).toBe('notes.md')
    expect(activeTab().generation).toBe(1)
  })

  it('creates inside a folder from its context menu', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    const src = await screen.findByText('src')

    fireEvent.contextMenu(src, { clientX: 40, clientY: 50 })
    fireEvent.click(screen.getByText('New folder'))
    const input = await screen.findByLabelText('New folder name')
    fireEvent.change(input, { target: { value: 'components' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(createEntry).toHaveBeenCalledWith('src/components', 'folder'))
    expect(activeTab().open).toContain('src')
  })

  it('keeps the name field open when the entry could not be created', async () => {
    createEntry.mockResolvedValueOnce({ ok: false, message: 'That name is already in use' })
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.click(screen.getByLabelText('New file'))
    const input = screen.getByLabelText('New file name')
    fireEvent.change(input, { target: { value: 'readme.md' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(createEntry).toHaveBeenCalledWith('readme.md', 'file'))
    expect(screen.getByLabelText('New file name')).toBeTruthy()
  })

  it('cancels a new entry with Escape', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.click(screen.getByLabelText('New folder'))
    fireEvent.keyDown(screen.getByLabelText('New folder name'), { key: 'Escape' })

    expect(screen.queryByLabelText('New folder name')).toBeNull()
    expect(createEntry).not.toHaveBeenCalled()
  })

  it('creates the first entry in an empty project', async () => {
    window.crew.readFile = async (path: string) =>
      path ? { kind: 'missing', path } : { kind: 'dir', path: '', entries: [] }
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('Open a project to see its files')

    fireEvent.click(screen.getByLabelText('New folder'))
    const input = screen.getByLabelText('New folder name')
    fireEvent.change(input, { target: { value: 'src' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(createEntry).toHaveBeenCalledWith('src', 'folder'))
  })

  it('drags a file into another folder and follows its new path', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())
    const source = rowFor('src/app.ts')!
    fireEvent.click(source)
    const target = document.querySelector('[data-folder="tests"]') as HTMLElement
    const dataTransfer = transfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    expect(target.className).toContain('ring-fg/20')
    fireEvent.drop(target, { dataTransfer })

    await waitFor(() => expect(moveEntry).toHaveBeenCalledWith('src/app.ts', 'tests'))
    expect(activeTab().path).toBe('tests/app.ts')
    expect(activeTab().open).toContain('tests')
    expect(activeTab().generation).toBe(1)
  })

  it('moves a folder to the root and rebases every path under it', async () => {
    useBrowser.getState().openFile('src/renderer/panel.tsx')
    useBrowser.getState().toggleTree(activeTab().id)
    render(createElement(BrowserPanel))
    await waitFor(() => expect(document.querySelector('[data-folder="src/renderer"]')).toBeTruthy())
    const source = document.querySelector('[data-folder="src/renderer"]') as HTMLElement
    const root = document.querySelector('[data-file-branch=""]') as HTMLElement
    const dataTransfer = transfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(root, { dataTransfer })
    fireEvent.drop(root, { dataTransfer })

    await waitFor(() => expect(moveEntry).toHaveBeenCalledWith('src/renderer', ''))
    expect(activeTab().path).toBe('renderer/panel.tsx')
    expect(activeTab().open).toContain('renderer')
    expect(activeTab().open).not.toContain('src/renderer')
  })

  it('does not offer a folder or its current parent as a drop target', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())
    const source = rowFor('src/app.ts')!
    const target = document.querySelector('[data-folder="src"]') as HTMLElement
    const dataTransfer = transfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    expect(moveEntry).not.toHaveBeenCalled()
    expect(target.className).not.toContain('ring-fg/20')
  })

  it('opens a closed folder after the dragged item rests over it', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    const source = await waitFor(() => {
      const found = rowFor('readme.md')
      expect(found).toBeTruthy()
      return found!
    })
    const target = document.querySelector('[data-folder="src"]') as HTMLElement
    const dataTransfer = transfer()
    vi.useFakeTimers()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    act(() => vi.advanceTimersByTime(FILE_DROP_EXPAND_MS - 1))
    expect(target.getAttribute('aria-expanded')).toBe('false')
    act(() => vi.advanceTimersByTime(1))
    expect(target.getAttribute('aria-expanded')).toBe('true')
  })

  it('leaves a closed folder shut when the drag moves away before the pause ends', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    const source = await waitFor(() => {
      const found = rowFor('readme.md')
      expect(found).toBeTruthy()
      return found!
    })
    const target = document.querySelector('[data-folder="src"]') as HTMLElement
    const elsewhere = document.querySelector('[data-folder="tests"]') as HTMLElement
    const dataTransfer = transfer()
    vi.useFakeTimers()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.dragLeave(target, { dataTransfer, relatedTarget: elsewhere })
    act(() => vi.advanceTimersByTime(FILE_DROP_EXPAND_MS))

    expect(target.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps scrolling each frame while a dragged file rests at the edge', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    const source = await waitFor(() => {
      const found = rowFor('readme.md')
      expect(found).toBeTruthy()
      return found!
    })
    const target = document.querySelector('[data-folder="src"]') as HTMLElement
    const host = document.querySelector('[data-file-scroll]') as HTMLElement
    host.getBoundingClientRect = () =>
      ({ top: 100, bottom: 500, left: 0, right: 280, width: 280, height: 400, x: 0, y: 100, toJSON: () => ({}) })
    const frames: FrameRequestCallback[] = []
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback)
      return frames.length
    })
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const dataTransfer = transfer()

    fireEvent.dragStart(source, { dataTransfer })
    const nearBottom = createEvent.dragOver(target, { dataTransfer })
    Object.defineProperty(nearBottom, 'clientY', { value: 495 })
    fireEvent(target, nearBottom)
    expect(frames).toHaveLength(1)
    act(() => frames.shift()!(0))
    const first = host.scrollTop
    expect(first).toBeGreaterThan(25)
    act(() => frames.shift()!(16))
    expect(host.scrollTop).toBeGreaterThan(first + 25)
    fireEvent.dragEnd(source, { dataTransfer })
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
    requestFrame.mockRestore()
    cancelFrame.mockRestore()
  })

  it('keeps search options out of the default view', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))

    await screen.findByText('src')
    expect(screen.getByLabelText('More search options')).toBeTruthy()
    expect(screen.queryByText('Match case')).toBeNull()
    expect(screen.queryByLabelText('Replace')).toBeNull()
    expect(screen.queryByLabelText('Files to include')).toBeNull()
  })

  it('resizes the files column and resets it with the Browser gesture', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')
    const handle = screen.getByRole('separator', { name: 'Resize files' })
    const tree = document.querySelector('[data-file-tree-width]') as HTMLElement

    fireEvent.pointerDown(handle, { clientX: 300, timeStamp: 1000 })
    fireEvent.pointerMove(window, { clientX: 250, timeStamp: 1010 })
    fireEvent.pointerUp(window, { clientX: 250, timeStamp: 1020 })
    expect(tree.getAttribute('data-file-tree-width')).toBe('338')

    fireEvent.pointerDown(handle, { clientX: 250, timeStamp: 2000 })
    fireEvent.pointerUp(window, { clientX: 250, timeStamp: 2010 })
    fireEvent.pointerDown(handle, { clientX: 250, timeStamp: 2200 })
    expect(tree.getAttribute('data-file-tree-width')).toBe('288')
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

  it('pins every open ancestor at its own row while its branch is on screen', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    fireEvent.click(await screen.findByText('renderer'))

    const src = document.querySelector('[data-sticky-folder="src"]') as HTMLElement
    const renderer = document.querySelector('[data-sticky-folder="src/renderer"]') as HTMLElement
    const branch = document.querySelector('[data-folder-branch="src"]') as HTMLElement

    expect(src.className).toContain('sticky')
    expect(src.className).toContain('after:-bottom-px')
    expect(src.style.top).toBe('0px')
    expect(renderer.style.top).toBe('29px')
    expect(Number(src.style.zIndex)).toBeGreaterThan(Number(renderer.style.zIndex))
    expect(branch.contains(renderer)).toBe(true)
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

    fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'panel' } })

    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())
    expect(rowFor('readme.md')).toBeNull()
    expect(rowFor('src/renderer/panel.tsx')!.textContent).toContain('src/renderer')
  })

  it('finds a folder by name and opens the folder itself', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'renderer' } })

    const result = await waitFor(() => {
      const found = document.querySelector('[data-folder="src/renderer"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    fireEvent.click(result)

    expect(activeTab().path).toBe('src/renderer')
    const contents = await waitFor(() => {
      const found = document.querySelector('[data-directory-contents="src/renderer"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    expect(contents.textContent).toContain('panel.tsx')
    expect(screen.queryByText('Pick a file from the project')).toBeNull()
  })

  it('picks out the letters that matched', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'pan' } })

    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())
    expect(rowFor('src/renderer/panel.tsx')!.querySelector('.text-fg')?.textContent).toBe('pan')
  })

  it('opens a file straight from the filter', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')
    fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'panel' } })
    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())

    fireEvent.click(rowFor('src/renderer/panel.tsx')!)

    expect(activeTab().path).toBe('src/renderer/panel.tsx')
  })

  it('finds text inside files and opens the matching line', async () => {
    useBrowser.getState().openFile('src/renderer/panel.tsx')
    render(createElement(BrowserPanel))
    fireEvent.click(screen.getByLabelText('Show files'))

    fireEvent.change(await screen.findByLabelText('Search files'), {
      target: { value: 'implementationDetail' }
    })

    const result = await waitFor(() => {
      const found = document.querySelector('[data-content-file="src/renderer/panel.tsx"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    expect(screen.getByText('Contents')).toBeTruthy()
    expect(result.textContent).toContain('const implementationDetail = true')
    expect(result.querySelector('.text-fg')?.textContent).toBe('implementationDetail')

    fireEvent.click(result)

    expect(activeTab().path).toBe('src/renderer/panel.tsx')
    expect(activeTab().line).toBe(7)
  })

  it('hands every search option to the project search', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.change(await screen.findByLabelText('Search files'), { target: { value: 'implementationDetail' } })
    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Match case'))
    fireEvent.click(screen.getByText('Match whole word'))
    fireEvent.click(screen.getByText('Use regular expression'))
    fireEvent.click(screen.getByText('File filters'))
    fireEvent.change(screen.getByLabelText('Files to include'), { target: { value: 'src/**' } })
    fireEvent.change(screen.getByLabelText('Files to exclude'), { target: { value: '**/*.test.ts' } })

    await waitFor(() => {
      const request = searchFiles.mock.calls.at(-1)?.[0]
      expect(request).toMatchObject({
        query: 'implementationDetail',
        matchCase: true,
        wholeWord: true,
        regex: true,
        include: 'src/**',
        exclude: '**/*.test.ts'
      })
    })
  })

  it('filters file names with the same include and exclude fields', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.change(await screen.findByLabelText('Search files'), { target: { value: 'app' } })
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())
    expect(rowFor('tests/app.test.ts')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('File filters'))
    fireEvent.change(screen.getByLabelText('Files to include'), { target: { value: 'tests/**' } })
    await waitFor(() => expect(rowFor('src/app.ts')).toBeNull())
    expect(rowFor('tests/app.test.ts')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Files to exclude'), { target: { value: 'tests/**' } })
    await waitFor(() => expect(rowFor('tests/app.test.ts')).toBeNull())
  })

  it('reports an invalid expression before any result is opened', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.change(await screen.findByLabelText('Search files'), { target: { value: '(' } })
    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Use regular expression'))

    expect(await screen.findByText(/Invalid regular expression/)).toBeTruthy()
    expect(document.querySelector('[data-content-file]')).toBeNull()
  })

  it('clears, refreshes, and collapses a result set without losing the query', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    const input = await screen.findByLabelText('Search files')
    fireEvent.change(input, { target: { value: 'implementationDetail' } })
    await waitFor(() => expect(document.querySelector('[data-content-file]')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Collapse results'))
    expect(document.querySelector('[data-content-file]')).toBeNull()
    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Show results'))
    expect(document.querySelector('[data-content-file]')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Clear results'))
    expect((input as HTMLInputElement).value).toBe('implementationDetail')
    expect(document.querySelector('[data-content-file]')).toBeNull()

    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Refresh search'))
    await waitFor(() => expect(document.querySelector('[data-content-file]')).toBeTruthy())
    expect(searchFiles.mock.calls.at(-1)?.[0].refresh).toBe(true)
  })

  it('replaces one exact match from its fixed action', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Replace'))
    fireEvent.change(await screen.findByLabelText('Search files'), { target: { value: 'implementationDetail' } })
    fireEvent.change(screen.getByLabelText('Replace'), { target: { value: 'implementation' } })
    await waitFor(() => expect(screen.getByLabelText('Replace match on line 7')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Replace match on line 7'))

    await waitFor(() => expect(replaceFiles).toHaveBeenCalledOnce())
    const request = replaceFiles.mock.calls[0]![0] as FileReplaceRequest
    expect(request).toMatchObject({
      query: 'implementationDetail',
      replacement: 'implementation',
      target: { path: 'src/renderer/panel.tsx', line: 7, column: 7, endColumn: 27 }
    })
  })

  it('replaces every content match with preserve case enabled', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Replace'))
    fireEvent.change(await screen.findByLabelText('Search files'), { target: { value: 'implementationDetail' } })
    fireEvent.change(screen.getByLabelText('Replace'), { target: { value: 'implementation' } })
    fireEvent.click(screen.getByLabelText('More search options'))
    fireEvent.click(screen.getByText('Preserve case'))
    await waitFor(() => expect(screen.getByLabelText('Replace all').hasAttribute('disabled')).toBe(false))

    fireEvent.click(screen.getByLabelText('Replace all'))

    await waitFor(() => expect(replaceFiles).toHaveBeenCalledOnce())
    expect(replaceFiles.mock.calls[0]![0]).toMatchObject({ preserveCase: true, target: undefined })
  })

  it('finds text in the open file with Ctrl+F', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    const editor = await screen.findByRole('textbox', { name: 'File contents' })

    fireEvent.keyDown(editor, { key: 'f', ctrlKey: true })
    const find = await screen.findByRole('textbox', { name: 'Find in this file' })
    const bar = find.parentElement!
    expect(bar.className.split(' ')).toContain('left-4')
    expect(bar.className.split(' ')).toContain('max-w-80')
    expect(bar.className.split(' ')).not.toContain('w-80')
    fireEvent.change(find, { target: { value: 'EXPORT' } })

    expect(await screen.findByText('1/1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next match' }).hasAttribute('disabled')).toBe(false)

    fireEvent.keyDown(find, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Find in this file' })).toBeNull())
  })

  it('says so plainly when nothing matches', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'zzzz' } })

    expect(await screen.findByText('Nothing found')).toBeTruthy()
  })

  it('puts the tree away and brings it back from the toolbar', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')

    fireEvent.click(screen.getByLabelText('Hide files'))
    await waitFor(() => expect(screen.queryByLabelText('Search files')).toBeNull())
    expect(activeTab().tree).toBe(false)
    expect(await screen.findByText('readme.md')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Show files'))
    expect(await screen.findByLabelText('Search files')).toBeTruthy()
  })

  it('lands on the file already showing rather than back at the top', async () => {
    useBrowser.getState().openFile('src/renderer/panel.tsx')
    render(createElement(BrowserPanel))
    await screen.findByText('export const panel = 2')

    fireEvent.click(screen.getByLabelText('Show files'))

    expect(activeTab().open).toEqual(['src', 'src/renderer'])
    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())
    expect(rowFor('src/renderer/panel.tsx')!.className).toContain('bg-fg/[0.06]')
  })

  it('leaves a file opened from a message without a tree', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))

    expect(activeTab().tree).toBe(false)
    expect(screen.queryByLabelText('Search files')).toBeNull()
  })

  it('goes back to the explorer already open rather than piling up tabs', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    useBrowser.getState().addTab()

    useBrowser.getState().openFiles()

    expect(useBrowser.getState().tabs.filter(tab => tab.kind === 'file').length).toBe(1)
    expect(activeTab().path).toBe('src/app.ts')
    expect(activeTab().tree).toBe(true)
    expect(activeTab().open).toEqual(['src'])
  })

  it('opens a file from the tree in a tab of its own, leaving the one it was picked from', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())

    fireEvent.contextMenu(rowFor('src/app.ts')!)
    fireEvent.click(screen.getByText('Open in a new tab'))

    const tabs = useBrowser.getState().tabs
    expect(tabs.length).toBe(2)
    expect(tabs[0]!.path).toBe('')
    expect(tabs[0]!.tree).toBe(true)
    expect(activeTab().id).toBe(tabs[1]!.id)
    expect(activeTab().path).toBe('src/app.ts')
    expect(await screen.findByText('export const one = 1')).toBeTruthy()
  })

  it('opens a file from the tree in a new tab when it is Shift-clicked', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())

    fireEvent.click(rowFor('src/app.ts')!, { shiftKey: true })

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(2)
    expect(tabs[0]!.path).toBe('')
    expect(tabs[0]!.tree).toBe(true)
    expect(activeTab().path).toBe('src/app.ts')
  })

  it('opens a file from the tree in a Browser window from its menu', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByText('src'))
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())

    fireEvent.contextMenu(rowFor('src/app.ts')!)
    fireEvent.click(screen.getByText('Open in new window'))

    expect(popOutBrowserTab).toHaveBeenCalledOnce()
    expect(popOutBrowserTab.mock.calls[0]![0]).toMatchObject({ kind: 'file', path: 'src/app.ts', line: null })
    expect(useBrowser.getState().tabs).toHaveLength(1)
  })

  it('opens a file from the folder listing in a tab of its own', async () => {
    useBrowser.getState().openFile('src')
    render(createElement(BrowserPanel))
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())

    fireEvent.contextMenu(rowFor('src/app.ts')!)
    fireEvent.click(screen.getByText('Open in a new tab'))

    expect(useBrowser.getState().tabs.length).toBe(2)
    expect(activeTab().path).toBe('src/app.ts')
  })

  it('opens a folder from the listing in a tab of its own', async () => {
    useBrowser.getState().openFile('')
    render(createElement(BrowserPanel))
    await waitFor(() => expect(document.querySelector('[data-folder="src"]')).toBeTruthy())

    fireEvent.contextMenu(document.querySelector('[data-folder="src"]') as HTMLElement)
    fireEvent.click(screen.getByText('Open in a new tab'))

    expect(useBrowser.getState().tabs.length).toBe(2)
    expect(activeTab().path).toBe('src')
    expect(await screen.findByText('app.ts')).toBeTruthy()
  })

  // A second tab on the file already showing is the whole reason to ask for one:
  // it keeps this file while the tab it was picked from goes on somewhere else.
  it('opens a second tab on the file already showing', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByLabelText('Show files'))
    await waitFor(() => expect(rowFor('src/app.ts')).toBeTruthy())

    fireEvent.contextMenu(rowFor('src/app.ts')!)
    fireEvent.click(screen.getByText('Open in a new tab'))

    const tabs = useBrowser.getState().tabs
    expect(tabs.length).toBe(2)
    expect(tabs.every(tab => tab.path === 'src/app.ts')).toBe(true)
  })

  it('opens a file straight from the filter into a tab of its own', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    await screen.findByText('src')
    fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'panel' } })
    await waitFor(() => expect(rowFor('src/renderer/panel.tsx')).toBeTruthy())

    fireEvent.contextMenu(rowFor('src/renderer/panel.tsx')!)
    fireEvent.click(screen.getByText('Open in a new tab'))

    expect(useBrowser.getState().tabs.length).toBe(2)
    expect(activeTab().path).toBe('src/renderer/panel.tsx')
  })

  it('opens a content match at its line in a new tab when it is Shift-clicked', async () => {
    useBrowser.getState().openFiles()
    render(createElement(BrowserPanel))
    fireEvent.change(await screen.findByLabelText('Search files'), {
      target: { value: 'implementationDetail' }
    })
    const result = await waitFor(() => {
      const found = document.querySelector('[data-content-file="src/renderer/panel.tsx"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })

    fireEvent.click(result, { shiftKey: true })

    expect(useBrowser.getState().tabs).toHaveLength(2)
    expect(activeTab().path).toBe('src/renderer/panel.tsx')
    expect(activeTab().line).toBe(7)
  })

  it('shows the files beside the one being looked at, not some other tab', () => {
    useBrowser.getState().openFile('src/app.ts')
    useBrowser.getState().openFile('src/renderer/panel.tsx')
    render(createElement(BrowserPanel))

    useBrowser.getState().openFiles()

    expect(activeTab().path).toBe('src/renderer/panel.tsx')
    expect(activeTab().tree).toBe(true)
  })
})
