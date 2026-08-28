// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { useBrowser } from '../src/renderer/src/state/browser'
import { canPreview, isSvg, type RepoFile } from '../src/shared/files'

if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []

const MARKUP = '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>\n'

const repo: Record<string, RepoFile> = {
  'art/logo.svg': { kind: 'file', path: 'art/logo.svg', text: MARKUP, truncated: false }
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

const openMenu = (): HTMLElement => document.body.querySelector('.fixed.z-\\[70\\]') as HTMLElement

describe('reading an SVG as a picture or its contents', () => {
  it('recognizes SVG files as previewable source', () => {
    expect(isSvg('art/logo.svg')).toBe(true)
    expect(isSvg('LOGO.SVG')).toBe(true)
    expect(isSvg('logo.svg.png')).toBe(false)
    expect(canPreview('art/logo.svg')).toBe(true)
  })

  it('opens as a picture unless a source line was requested', () => {
    useBrowser.getState().openFile('art/logo.svg')
    expect(useBrowser.getState().tabs[0]!.preview).toBe(true)

    useBrowser.setState({ tabs: [], activeTabId: null })
    useBrowser.getState().openFile('art/logo.svg', 1)
    expect(useBrowser.getState().tabs[0]!.preview).toBe(false)
  })

  it('switches from code to the picture through its context menu', async () => {
    useBrowser.getState().openFile('art/logo.svg')
    useBrowser.getState().togglePreview(useBrowser.getState().activeTabId!)
    render(createElement(BrowserPanel))
    const contents = await screen.findByLabelText('File contents')

    expect((contents as HTMLTextAreaElement).value).toBe(MARKUP)
    fireEvent.contextMenu(contents, { clientX: 120, clientY: 90 })
    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Show preview' }))

    await waitFor(() => expect(screen.getByAltText('art/logo.svg')).toBeTruthy())
    expect(screen.queryByLabelText('File contents')).toBeNull()
  })

  it('switches from the picture back to its contents through its context menu', async () => {
    useBrowser.getState().openFile('art/logo.svg')
    render(createElement(BrowserPanel))
    const picture = await screen.findByAltText('art/logo.svg')

    fireEvent.contextMenu(picture, { clientX: 150, clientY: 110 })
    fireEvent.click(within(openMenu()).getByRole('button', { name: 'Show contents' }))

    await waitFor(() => expect(screen.getByLabelText('File contents')).toBeTruthy())
    expect(screen.queryByAltText('art/logo.svg')).toBeNull()
  })

  it('previews unsaved SVG edits', async () => {
    useBrowser.getState().openFile('art/logo.svg')
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByLabelText('Show contents'))
    const contents = await screen.findByLabelText('File contents')
    const edited = '<svg viewBox="0 0 20 20"><rect width="20" height="20"/></svg>\n'

    fireEvent.change(contents, { target: { value: edited } })
    fireEvent.click(screen.getByLabelText('Show preview'))

    const picture = await screen.findByAltText('art/logo.svg')
    expect(picture.getAttribute('src')).toBe(`data:image/svg+xml;utf8,${encodeURIComponent(edited)}`)
  })
})
