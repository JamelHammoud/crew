// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { fileTokens, parseFileRef, TextWithFileLinks } from '../src/renderer/src/components/fileLinks'
import FilesChanged from '../src/renderer/src/components/FilesChanged'
import Markdown from '../src/renderer/src/components/Markdown'
import StepRow from '../src/renderer/src/components/StepRow'
import type { ThreadItem } from '../src/renderer/src/components/thread'
import { useBrowser } from '../src/renderer/src/state/browser'
import type { PathLocation, RepoFile } from '../src/shared/files'
import type { AgentStep } from '../src/shared/llm'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

const repo: Record<string, RepoFile> = {
  '': {
    kind: 'dir',
    path: '',
    entries: [
      { name: 'src', dir: true },
      { name: 'readme.md', dir: false }
    ]
  },
  src: { kind: 'dir', path: 'src', entries: [{ name: 'app.ts', dir: false }] },
  'src/app.ts': {
    kind: 'file',
    path: 'src/app.ts',
    text: 'const one = 1\nconst two = 2\nconst three = 3',
    truncated: false
  },
  'big.log': { kind: 'file', path: 'big.log', text: 'line one\nline two', truncated: true },
  'logo.png': { kind: 'image', path: 'logo.png', url: 'data:image/png;base64,AAAA', size: 6 }
}

const SHOT = '/tmp/qlout/cursor-preview.svg.png'

const machine: Record<string, RepoFile> = {
  [SHOT]: { kind: 'image', path: SHOT, url: 'data:image/png;base64,BBBB', size: 12 },
  '/tmp/qlout/run.log': { kind: 'file', path: '/tmp/qlout/run.log', text: 'started\ndone', truncated: false }
}

const ROOT = '/Users/me/code/crew'

function locate(raw: string): PathLocation {
  const target = raw.split('\\').join('/')
  if (/^[A-Za-z]:\//.test(target)) {
    const parts = target.split('/').filter(Boolean)
    for (let start = 0; start <= parts.length - 2; start++) {
      const relative = parts.slice(start).join('/')
      if (relative in repo) return { kind: 'repo', path: relative, exists: true }
    }
    return { kind: 'private' }
  }
  if (!target.startsWith('/')) return { kind: 'repo', path: target, exists: target in repo }
  if (target.startsWith(`${ROOT}/`)) {
    const relative = target.slice(ROOT.length + 1)
    return { kind: 'repo', path: relative, exists: relative in repo }
  }
  const parts = target.split('/').filter(Boolean)
  for (let start = 0; start <= parts.length - 2; start++) {
    const relative = parts.slice(start).join('/')
    if (relative in repo) return { kind: 'repo', path: relative, exists: true }
  }
  return target in machine ? { kind: 'local', exists: true } : { kind: 'private' }
}

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null })
  window.crew = {
    readFile: async (path: string) => repo[path] ?? machine[path] ?? { kind: 'missing', path },
    writeFile: async () => null,
    locatePath: async (path: string) => locate(path),
    revealFile: async () => undefined,
    openExternal: async () => undefined
  } as unknown as CrewBridge
})

afterEach(() => cleanup())

describe('file refs', () => {
  it('parses paths with optional line numbers', () => {
    expect(parseFileRef('src/app.ts')).toEqual({ path: 'src/app.ts', line: null })
    expect(parseFileRef('./src/app.ts:12')).toEqual({ path: 'src/app.ts', line: 12 })
    expect(parseFileRef('src/app.ts:12:5')).toEqual({ path: 'src/app.ts', line: 12 })
    expect(parseFileRef('package.json')).toEqual({ path: 'package.json', line: null })
    expect(parseFileRef('https://example.com/a.ts')).toBeNull()
    expect(parseFileRef('../outside.ts')).toBeNull()
    expect(parseFileRef('hello world')).toBeNull()
  })

  it('finds candidates in plain text but skips versions, domains, and urls', () => {
    const tokens = fileTokens('fixed src/app.ts:3 and AGENTS.md, not 0.51.4, e.g. example.com or https://a.dev/x/y')
    const files = tokens.filter(t => t.kind === 'file')
    expect(files.map(t => (t.kind === 'file' ? t.path : ''))).toEqual(['src/app.ts', 'AGENTS.md'])
  })
})

describe('markdown file links', () => {
  it('links mentions of real files and leaves unknown paths as text', async () => {
    render(createElement(Markdown, { text: 'Edited `src/app.ts:2` and touched src/other.ts today' }))
    await waitFor(() => expect(document.querySelectorAll('a.file-link').length).toBe(1))
    const link = document.querySelector('a.file-link') as HTMLAnchorElement
    expect(link.dataset.path).toBe('src/app.ts')
    fireEvent.click(link)
    const tab = useBrowser.getState().tabs[0]
    expect(tab.kind).toBe('file')
    expect(tab.path).toBe('src/app.ts')
    expect(tab.line).toBe(2)
  })

  it('does not link prose slashes like Undo/redo', async () => {
    render(createElement(Markdown, { text: 'Undo/redo moved and either/or stays, see src/app.ts' }))
    await waitFor(() => expect(document.querySelectorAll('a.file-link').length).toBe(1))
    const link = document.querySelector('a.file-link') as HTMLAnchorElement
    expect(link.dataset.path).toBe('src/app.ts')
    expect(link.textContent).toBe('src/app.ts')
  })

  it('opens relative markdown links as files and leaves web links alone', () => {
    render(createElement(Markdown, { text: '[the app](src/app.ts) and [site](https://example.com)' }))
    const links = [...document.querySelectorAll('a')]
    fireEvent.click(links[0])
    expect(useBrowser.getState().tabs[0].path).toBe('src/app.ts')
    fireEvent.click(links[1])
    const tabs = useBrowser.getState().tabs
    expect(tabs.some(t => t.kind === 'web' && t.url === 'https://example.com')).toBe(true)
  })

  it('shows full paths from this project relative to the project', async () => {
    render(createElement(Markdown, { text: `Edited \`${ROOT}/src/app.ts:2\` today` }))
    await waitFor(() => expect(document.querySelectorAll('a.file-link').length).toBe(1))
    const link = document.querySelector('a.file-link') as HTMLAnchorElement
    expect(link.textContent).toBe('src/app.ts:2')
    expect(link.dataset.path).toBe('src/app.ts')
    fireEvent.click(link)
    expect(useBrowser.getState().tabs[0].line).toBe(2)
  })

  it('maps a path from another computer onto the same file here', async () => {
    render(createElement(Markdown, { text: 'Look at /Users/ali/projects/crew/src/app.ts for the fix' }))
    await waitFor(() => expect(document.querySelectorAll('a.file-link').length).toBe(1))
    const link = document.querySelector('a.file-link') as HTMLAnchorElement
    expect(link.textContent).toBe('src/app.ts')
    expect(link.dataset.path).toBe('src/app.ts')
    expect(document.body.textContent).not.toContain('/Users/ali')
  })

  it('hides files that live on someone else’s computer', async () => {
    render(createElement(Markdown, { text: 'Saved it to `/Users/ali/Desktop/notes.md` just now' }))
    await screen.findByText('Private file')
    expect(document.body.textContent).not.toContain('/Users/ali')
  })

  it('does not link inside code blocks', () => {
    render(createElement(Markdown, { text: '```\nsrc/app.ts\n```' }))
    expect(document.querySelectorAll('a.file-link').length).toBe(0)
  })
})

describe('markdown tables', () => {
  const table = ['| Control | Click behavior |', '| --- | --- |', '| Pointer | Selects and moves |'].join('\n')

  it('renders a table with header and body cells inside a scroll wrapper', () => {
    render(createElement(Markdown, { text: table }))
    const wrapper = document.querySelector('.md > .table-scroll')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.firstElementChild?.tagName).toBe('TABLE')
    expect([...document.querySelectorAll('th')].map(cell => cell.textContent)).toEqual([
      'Control',
      'Click behavior'
    ])
    expect([...document.querySelectorAll('tbody td')].map(cell => cell.textContent)).toEqual([
      'Pointer',
      'Selects and moves'
    ])
  })

  it('still links files written inside a table cell', async () => {
    render(createElement(Markdown, { text: '| File | Note |\n| --- | --- |\n| `src/app.ts:2` | fixed |' }))
    await waitFor(() => expect(document.querySelectorAll('td a.file-link').length).toBe(1))
    fireEvent.click(document.querySelector('td a.file-link') as HTMLAnchorElement)
    expect(useBrowser.getState().tabs[0].path).toBe('src/app.ts')
  })
})

describe('plain text file links', () => {
  it('renders chips for real files that open them', async () => {
    render(createElement(TextWithFileLinks, { text: 'undo/redo aside, please check src/app.ts:2 soon' }))
    const chip = await screen.findByText('src/app.ts:2')
    expect(document.querySelectorAll('code').length).toBe(1)
    fireEvent.click(chip)
    const tab = useBrowser.getState().tabs[0]
    expect(tab.path).toBe('src/app.ts')
    expect(tab.line).toBe(2)
  })

  it('shortens project paths and hides other computers', async () => {
    render(createElement(TextWithFileLinks, { text: `wrote ${ROOT}/src/app.ts and /Users/ali/Desktop/notes.md` }))
    const chip = await screen.findByText('src/app.ts')
    fireEvent.click(chip)
    expect(useBrowser.getState().tabs[0].path).toBe('src/app.ts')
    await screen.findByText('Private file')
    expect(document.body.textContent).not.toContain('/Users/ali')
  })
})

describe('web links', () => {
  it('opens a link written in a message', async () => {
    render(createElement(TextWithFileLinks, { text: 'watch https://roxie.com/film/backrooms/ tonight' }))
    const link = await screen.findByText('https://roxie.com/film/backrooms/')
    fireEvent.click(link)
    const tab = useBrowser.getState().tabs[0]
    expect(tab.kind).toBe('web')
    expect(tab.url).toBe('https://roxie.com/film/backrooms/')
  })

  it('keeps sentence punctuation out of the link', () => {
    const tokens = fileTokens('see https://example.com/a, or https://example.com/wiki/thing_(film).')
    expect(tokens.flatMap(t => (t.kind === 'url' ? [t.text] : []))).toEqual([
      'https://example.com/a',
      'https://example.com/wiki/thing_(film)'
    ])
  })

  it('still finds files around a link', () => {
    const tokens = fileTokens('https://example.com/x broke src/app.ts:3')
    expect(tokens.flatMap(t => (t.kind === 'file' ? [t.path] : []))).toEqual(['src/app.ts'])
  })

  it('opens a bare link an agent sends', () => {
    render(createElement(Markdown, { text: 'try https://example.com/watch now' }))
    const link = screen.getByText('https://example.com/watch')
    fireEvent.click(link)
    expect(useBrowser.getState().tabs[0].url).toBe('https://example.com/watch')
  })
})

describe('changed file lists', () => {
  const step = (path: string): AgentStep => ({
    id: 't1',
    kind: 'tool',
    status: 'done',
    ts: 0,
    name: 'Edit',
    files: [{ path, added: 3, removed: 1 }]
  })

  it('shortens a windows path from another computer and opens the file here', async () => {
    render(createElement(FilesChanged, { steps: [step('C:\\Users\\Ali Hammoud\\crew\\src\\app.ts')] }))
    fireEvent.click(screen.getByRole('button'))
    const link = await screen.findByText('src/app.ts')
    expect(document.body.textContent).not.toContain('C:\\Users')
    fireEvent.click(link)
    expect(useBrowser.getState().tabs[0].path).toBe('src/app.ts')
  })

  it('hides a changed file that lives on someone else’s computer', async () => {
    render(createElement(FilesChanged, { steps: [step('C:\\Users\\Ali Hammoud\\Desktop\\notes.md')] }))
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText('Private file')
    expect(document.body.textContent).not.toContain('Ali Hammoud')
  })

  it('shortens the path shown on a step row', async () => {
    const item: ThreadItem = {
      key: 'p1:t1',
      ts: 0,
      kind: 'tool',
      author: 'Claude',
      self: false,
      text: '',
      streaming: false,
      name: 'Edit',
      files: [{ path: `${ROOT}/src/app.ts`, added: 3, removed: 1 }]
    }
    render(createElement(StepRow, { item }))
    await screen.findByText('src/app.ts')
    expect(document.body.textContent).not.toContain(ROOT)
  })
})

describe('steps and thinking', () => {
  const item = (patch: Partial<ThreadItem>): ThreadItem => ({
    key: 'p1:s1',
    ts: 0,
    kind: 'tool',
    author: 'Claude',
    self: false,
    text: '',
    streaming: false,
    ...patch
  })

  it('opens a file an agent read from the step row', async () => {
    render(createElement(StepRow, { item: item({ name: 'Read', detail: `${ROOT}/src/app.ts` }) }))
    const link = await screen.findByText('src/app.ts')
    expect(document.body.textContent).not.toContain(ROOT)
    fireEvent.click(link)
    expect(useBrowser.getState().tabs[0].path).toBe('src/app.ts')
    expect(screen.getAllByText('src/app.ts').length).toBe(1)
  })

  it('opens a file named inside a command', async () => {
    render(createElement(StepRow, { item: item({ name: 'Bash', detail: 'yarn vitest run src/app.ts' }) }))
    const link = await screen.findByText('src/app.ts')
    fireEvent.click(link)
    expect(useBrowser.getState().tabs[0].path).toBe('src/app.ts')
  })

  it('opens a file an agent named while thinking, without the backticks', async () => {
    const thought = 'Next I will read `src/app.ts:3` and then src/other.ts'
    render(createElement(StepRow, { item: item({ kind: 'thinking', text: thought }) }))
    fireEvent.click(screen.getByText('Thinking'))
    const link = await screen.findByText('src/app.ts:3')
    expect(document.body.textContent).not.toContain('`')
    expect(document.body.textContent).toContain('src/other.ts')
    fireEvent.click(link)
    const tab = useBrowser.getState().tabs[0]
    expect(tab.path).toBe('src/app.ts')
    expect(tab.line).toBe(3)
  })

  it('opens a file that is on this computer but outside the project', async () => {
    render(createElement(StepRow, { item: item({ name: 'Read', detail: `Read ${SHOT}` }) }))
    const link = await screen.findByText(SHOT)
    fireEvent.click(link)
    expect(useBrowser.getState().tabs[0].path).toBe(SHOT)
  })

  it('hides a thought about a file on someone else’s computer', async () => {
    render(createElement(StepRow, { item: item({ kind: 'thinking', text: 'I saved /Users/ali/Desktop/notes.md' }) }))
    fireEvent.click(screen.getByText('Thinking'))
    await screen.findByText('Private file')
    expect(document.body.textContent).not.toContain('/Users/ali')
  })
})

describe('file view', () => {
  it('shows file contents with the target line marked', async () => {
    useBrowser.getState().openFile('src/app.ts', 2)
    render(createElement(BrowserPanel))
    await screen.findByText('const two = 2')
    const row = document.querySelector('[data-line="2"]')
    expect(row).not.toBeNull()
    expect(row?.className).toContain('bg-fg')
  })

  it('browses folders from the breadcrumbs', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    fireEvent.click(screen.getByRole('button', { name: 'Project files' }))
    await screen.findByText('readme.md')
    fireEvent.click(screen.getByText('src'))
    await screen.findByText('app.ts')
    fireEvent.click(screen.getByText('app.ts'))
    await screen.findByText('const three = 3')
    const tab = useBrowser.getState().tabs[0]
    expect(tab.back).toEqual(['src/app.ts', '', 'src'])
  })

  it('shows a message for files that are not in the project', async () => {
    useBrowser.getState().openFile('gone/missing.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('This file is not in the project')
  })

  it('shows a picture instead of the bytes behind it', async () => {
    useBrowser.getState().openFile('logo.png')
    render(createElement(BrowserPanel))
    const image = await screen.findByAltText('logo.png')
    expect(image.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('shows a screenshot an agent took outside the project', async () => {
    useBrowser.getState().openFile(SHOT)
    render(createElement(BrowserPanel))
    const image = await screen.findByAltText(SHOT)
    expect(image.getAttribute('src')).toBe('data:image/png;base64,BBBB')
    fireEvent.click(screen.getByText('qlout'))
    expect(useBrowser.getState().tabs[0].path).toBe('/tmp/qlout')
  })

  it('reads a file from this computer that is outside the project', async () => {
    useBrowser.getState().openFile('/tmp/qlout/run.log')
    render(createElement(BrowserPanel))
    await screen.findByText('started')
  })

  it('highlights code once the grammar loads', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    await waitFor(() => {
      const first = document.querySelector('[data-line="1"]')
      const colored = [...(first?.querySelectorAll('span[style]') ?? [])] as HTMLElement[]
      expect(colored.some(span => span.textContent === 'const' && span.style.color !== '')).toBe(true)
    })
  })
})

describe('file editing', () => {
  it('edits in place and saves through the bridge', async () => {
    const writes: Array<{ path: string; text: string }> = []
    const crew = window.crew as unknown as { writeFile(path: string, text: string): Promise<RepoFile> }
    crew.writeFile = async (path: string, text: string) => {
      writes.push({ path, text })
      return { kind: 'file', path, text, truncated: false }
    }
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    const editor = screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement
    expect(editor.value).toContain('const one = 1')
    fireEvent.change(editor, { target: { value: 'const four = 4\nconst five = 5' } })
    await waitFor(() =>
      expect(document.querySelector('[data-line="2"]')?.textContent).toContain('const five = 5')
    )
    expect(document.querySelectorAll('[data-line]').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(writes).toEqual([{ path: 'src/app.ts', text: 'const four = 4\nconst five = 5' }])
    )
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    expect((screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement).value).toBe(
      'const four = 4\nconst five = 5'
    )
  })

  it('keeps line numbers and colors while editing', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    const editor = screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'const one = 1\nconst two = 2\nconst three = 3\nconst four = 4' } })
    await waitFor(() =>
      expect(document.querySelector('[data-line="4"]')?.textContent).toContain('const four = 4')
    )
    expect(document.querySelectorAll('[data-line]').length).toBe(4)
    await waitFor(() => {
      const last = document.querySelector('[data-line="4"]')
      const colored = [...(last?.querySelectorAll('span[style]') ?? [])] as HTMLElement[]
      expect(colored.some(span => span.textContent === 'const' && span.style.color !== '')).toBe(true)
    })
  })

  it('escape discards unsaved changes', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    const editor = screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'scrapped' } })
    await waitFor(() => expect(document.querySelector('[data-line="1"]')?.textContent).toContain('scrapped'))
    fireEvent.keyDown(editor, { key: 'Escape' })
    await waitFor(() =>
      expect(document.querySelector('[data-line="1"]')?.textContent).toContain('const one = 1')
    )
    expect(editor.value).toBe('const one = 1\nconst two = 2\nconst three = 3')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('saves with cmd+s', async () => {
    const writes: string[] = []
    const crew = window.crew as unknown as { writeFile(path: string, text: string): Promise<RepoFile> }
    crew.writeFile = async (path: string, text: string) => {
      writes.push(text)
      return { kind: 'file', path, text, truncated: false }
    }
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    const editor = screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'const four = 4' } })
    fireEvent.keyDown(editor, { key: 's', metaKey: true })
    await waitFor(() => expect(writes).toEqual(['const four = 4']))
  })

  it('stays dirty and shows a note when saving fails', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    const editor = screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'const four = 4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Could not save')
    expect(editor.value).toBe('const four = 4')
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeNull()
  })

  it('leaves truncated files read only', async () => {
    useBrowser.getState().openFile('big.log')
    render(createElement(BrowserPanel))
    await screen.findByText('line one')
    expect(screen.queryByRole('textbox', { name: 'File contents' })).toBeNull()
    await screen.findByText('Showing the beginning of this file')
  })
})
