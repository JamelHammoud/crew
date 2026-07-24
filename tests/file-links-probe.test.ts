// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { fileTokens, parseFileRef, TextWithFileLinks } from '../src/renderer/src/components/fileLinks'
import Markdown from '../src/renderer/src/components/Markdown'
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
      { name: 'readme.md', dir: false }
    ]
  },
  src: { kind: 'dir', path: 'src', entries: [{ name: 'app.ts', dir: false }] },
  'src/app.ts': {
    kind: 'file',
    path: 'src/app.ts',
    text: 'const one = 1\nconst two = 2\nconst three = 3',
    truncated: false
  }
}

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null })
  window.crew = {
    readFile: async (path: string) => repo[path] ?? { kind: 'missing', path },
    writeFile: async () => null,
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

  it('finds paths in plain text but skips versions, domains, and urls', () => {
    const tokens = fileTokens('fixed src/app.ts:3 and AGENTS.md, not 0.51.4, e.g. example.com or https://a.dev/x/y')
    const files = tokens.filter(t => t.kind === 'file')
    expect(files.map(t => (t.kind === 'file' ? t.path : ''))).toEqual(['src/app.ts', 'AGENTS.md'])
  })
})

describe('markdown file links', () => {
  it('turns file mentions into links and opens them in the panel', () => {
    render(createElement(Markdown, { text: 'Edited `src/app.ts:2` and touched src/other.ts today' }))
    const links = document.querySelectorAll('a.file-link')
    expect(links.length).toBe(2)
    fireEvent.click(links[0])
    const tab = useBrowser.getState().tabs[0]
    expect(tab.kind).toBe('file')
    expect(tab.path).toBe('src/app.ts')
    expect(tab.line).toBe(2)
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

  it('does not link inside code blocks', () => {
    render(createElement(Markdown, { text: '```\nsrc/app.ts\n```' }))
    expect(document.querySelectorAll('a.file-link').length).toBe(0)
  })
})

describe('plain text file links', () => {
  it('renders chips that open the file', () => {
    render(createElement(TextWithFileLinks, { text: 'please check src/app.ts:2 soon' }))
    fireEvent.click(screen.getByText('src/app.ts:2'))
    const tab = useBrowser.getState().tabs[0]
    expect(tab.path).toBe('src/app.ts')
    expect(tab.line).toBe(2)
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
  it('edits a file and saves it through the bridge', async () => {
    const writes: Array<{ path: string; text: string }> = []
    const crew = window.crew as unknown as { writeFile(path: string, text: string): Promise<RepoFile> }
    crew.writeFile = async (path: string, text: string) => {
      writes.push({ path, text })
      return { kind: 'file', path, text, truncated: false }
    }
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit file' }))
    const editor = screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement
    expect(editor.value).toContain('const one = 1')
    fireEvent.change(editor, { target: { value: 'const four = 4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('const four = 4')
    expect(writes).toEqual([{ path: 'src/app.ts', text: 'const four = 4' }])
    expect(screen.queryByRole('textbox', { name: 'File contents' })).toBeNull()
  })

  it('escape discards the edit', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit file' }))
    const editor = screen.getByRole('textbox', { name: 'File contents' }) as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'scrapped' } })
    fireEvent.keyDown(editor, { key: 'Escape' })
    await screen.findByText('const one = 1')
    expect(screen.queryByRole('textbox', { name: 'File contents' })).toBeNull()
  })

  it('stays in the editor when saving fails', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await screen.findByText('const one = 1')
    fireEvent.click(screen.getByRole('button', { name: 'Edit file' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Could not save')
    expect(screen.getByRole('textbox', { name: 'File contents' })).not.toBeNull()
  })
})
