// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { imagePath, imagesIn } from '../src/renderer/src/components/mdImages'
import { useBrowser } from '../src/renderer/src/state/browser'
import { isMarkdown, type RepoFile } from '../src/shared/files'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

const SHOT = 'data:image/png;base64,iVBORw0KGgo='

const PAGE = `# Notes

Some words and a [link](https://example.com).

![A shot](docs/shot.png)
`

const repo: Record<string, RepoFile> = {
  'readme.md': { kind: 'file', path: 'readme.md', text: PAGE, truncated: false },
  'docs/shot.png': { kind: 'image', path: 'docs/shot.png', url: SHOT, size: 12 },
  'src/app.ts': { kind: 'file', path: 'src/app.ts', text: '# not a page\n', truncated: false }
}

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null })
  Element.prototype.scrollIntoView = () => undefined
  window.crew = {
    readFile: async (path: string) => repo[path] ?? { kind: 'missing', path },
    listFiles: async () => Object.keys(repo),
    writeFile: async () => null,
    revealFile: async () => undefined,
    openExternal: async () => undefined,
    warmTerminal: () => undefined
  } as unknown as CrewBridge
})

afterEach(() => cleanup())

const page = () => document.querySelector('[data-markdown-page]')

describe('reading a markdown file as the page it is written to be', () => {
  it('tells a page from a file by its name', () => {
    expect(isMarkdown('readme.md')).toBe(true)
    expect(isMarkdown('docs/notes.markdown')).toBe(true)
    expect(isMarkdown('AGENTS.MD')).toBe(true)
    expect(isMarkdown('src/app.ts')).toBe(false)
    expect(isMarkdown('md')).toBe(false)
    expect(isMarkdown('')).toBe(false)
  })

  it('offers the preview on a markdown file and nowhere else', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await waitFor(() => expect(screen.getByLabelText('File contents')).toBeTruthy())

    expect(screen.queryByLabelText('Show preview')).toBeNull()

    useBrowser.getState().openFile('readme.md')

    expect(await screen.findByLabelText('Show preview')).toBeTruthy()
  })

  it('draws the page in place of the text, and the text again on the way back', async () => {
    useBrowser.getState().openFile('readme.md')
    render(createElement(BrowserPanel))

    fireEvent.click(await screen.findByLabelText('Show preview'))

    await waitFor(() => expect(page()).not.toBeNull())
    expect(page()!.querySelector('h1')?.textContent).toBe('Notes')
    expect(screen.queryByLabelText('File contents')).toBeNull()

    fireEvent.click(screen.getByLabelText('Hide preview'))

    await waitFor(() => expect(page()).toBeNull())
    expect(screen.getByLabelText('File contents')).toBeTruthy()
  })

  it('keeps the way it is read while walking from one page to the next', async () => {
    useBrowser.getState().openFile('readme.md')
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByLabelText('Show preview'))
    await waitFor(() => expect(page()).not.toBeNull())

    const { tabs, activeTabId } = useBrowser.getState()
    expect(tabs.find(tab => tab.id === activeTabId)!.preview).toBe(true)
  })

  it('puts a picture beside the page on the page', async () => {
    useBrowser.getState().openFile('readme.md')
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByLabelText('Show preview'))

    await waitFor(() => expect(page()?.querySelector(`img[src="${SHOT}"]`)).toBeTruthy())
  })

  it('reads the page as it stands, edits and all', async () => {
    useBrowser.getState().openFile('readme.md')
    render(createElement(BrowserPanel))
    const area = await screen.findByLabelText('File contents')

    fireEvent.change(area, { target: { value: '# Written just now\n' } })
    fireEvent.click(screen.getByLabelText('Show preview'))

    await waitFor(() => expect(page()?.querySelector('h1')?.textContent).toBe('Written just now'))
    expect(screen.getByText('Save')).toBeTruthy()
  })
})

describe('where a picture on a page really sits', () => {
  it('finds every picture the page points at on this machine', () => {
    expect(imagesIn(PAGE)).toEqual(['docs/shot.png'])
    expect(imagesIn('![a](https://example.com/a.png)')).toEqual([])
    expect(imagesIn('<img src="shot.png" alt="a">')).toEqual(['shot.png'])
    expect(imagesIn('![a](one.png) ![b](one.png)')).toEqual(['one.png'])
  })

  it('reads a path beside the page it was written on', () => {
    expect(imagePath('docs/guide.md', 'shot.png')).toBe('docs/shot.png')
    expect(imagePath('docs/guide.md', './art/shot.png')).toBe('docs/art/shot.png')
    expect(imagePath('docs/deep/guide.md', '../shot.png')).toBe('docs/shot.png')
    expect(imagePath('readme.md', 'shot.png')).toBe('shot.png')
  })

  it('reads one written from the top against the project, or against this machine', () => {
    expect(imagePath('docs/guide.md', '/art/shot.png')).toBe('art/shot.png')
    expect(imagePath('/Users/one/notes/guide.md', 'shot.png')).toBe('/Users/one/notes/shot.png')
    expect(imagePath('/Users/one/notes/guide.md', '/tmp/shot.png')).toBe('/tmp/shot.png')
  })

  it('takes a name as it was written rather than as it was encoded', () => {
    expect(imagePath('docs/guide.md', 'my%20shot.png')).toBe('docs/my shot.png')
    expect(imagePath('docs/guide.md', 'shot.png?v=2')).toBe('docs/shot.png')
  })
})
