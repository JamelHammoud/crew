// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { useBrowser } from '../src/renderer/src/state/browser'

class Blind {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = Blind as unknown as typeof ResizeObserver
global.IntersectionObserver = Blind as unknown as typeof IntersectionObserver
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []

const PAGE = `<!doctype html>
<html>
  <head><title>Hello everyone</title></head>
  <body><h1>Four colour process</h1></body>
</html>
`

const DRAWING = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle r="4" cx="4" cy="4"/></svg>'

const NOTES = '# Notes\n\nSome words.\n'

const files: Record<string, string> = {
  'http://host/attachments/one.html': PAGE,
  'http://host/attachments/two.svg': DRAWING,
  'http://host/attachments/three.md': NOTES,
  'http://host/attachments/four.txt': 'Plain words.\n'
}

let stood: { id: string; path: string; text: string }[] = []
let dropped: string[] = []
let made = 0

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null, open: true })
  stood = []
  dropped = []
  made = 0
  Element.prototype.scrollIntoView = () => undefined
  global.fetch = (async (url: string) => {
    const text = files[String(url)]
    if (text === undefined) return { ok: false, status: 404 }
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(text).slice().buffer }
  }) as unknown as typeof fetch
  window.crew = {
    readFile: async (path: string) => ({ kind: 'missing', path }),
    listFiles: async () => [],
    previewHtml: async (id: string, path: string, text: string) => {
      stood.push({ id, path, text })
      made += 1
      return `file:///tmp/crew-previews/page-${made}.html`
    },
    dropPreview: async (id: string) => {
      dropped.push(id)
    },
    revealFile: async () => undefined,
    openExternal: async () => undefined,
    warmTerminal: () => undefined
  } as unknown as CrewBridge
})

afterEach(() => cleanup())

const page = () => document.querySelector('[data-html-page] webview') as HTMLElement | null

const drawing = () => document.querySelector('[data-image-frame] img') as HTMLImageElement | null

const open = (file: string, name: string, mime = 'text/plain'): void =>
  useBrowser.getState().openAttachment(`http://host/attachments/${file}`, name, mime, 7600)

describe('a page somebody attached', () => {
  it('opens as the page it is written to be', async () => {
    open('one.html', 'hello-everyone.html')
    render(createElement(BrowserPanel))

    await waitFor(() => expect(page()).not.toBeNull())
    expect(page()!.getAttribute('src')).toBe('file:///tmp/crew-previews/page-1.html')
  })

  // The words are read here and stood up away from the address the session is
  // served on, so nothing on the page is running inside it. There is no file
  // behind one, so there is no folder to hand it either.
  it('is drawn from the words rather than from the session', async () => {
    open('one.html', 'hello-everyone.html')
    render(createElement(BrowserPanel))

    await waitFor(() => expect(stood).toHaveLength(1))
    expect(stood[0]!.text).toBe(PAGE)
    expect(stood[0]!.path).toBe('')
  })

  it('shows the text it is written in and the page again on the way back', async () => {
    open('one.html', 'hello-everyone.html')
    render(createElement(BrowserPanel))
    await waitFor(() => expect(page()).not.toBeNull())

    fireEvent.click(screen.getByLabelText('Show the text'))

    await waitFor(() => expect(page()).toBeNull())
    expect(screen.getByText('<!doctype html>')).toBeTruthy()
    expect(dropped).toEqual([stood[0]!.id])

    fireEvent.click(screen.getByLabelText('Show the page'))

    await waitFor(() => expect(page()).not.toBeNull())
  })

  it('draws a vector as the picture it is, running nothing', async () => {
    open('two.svg', 'logo.svg')
    render(createElement(BrowserPanel))

    await waitFor(() => expect(drawing()).not.toBeNull())
    expect(drawing()!.getAttribute('src')).toBe(`data:image/svg+xml;utf8,${encodeURIComponent(DRAWING)}`)
    expect(stood).toEqual([])

    fireEvent.click(screen.getByLabelText('Show the text'))

    await waitFor(() => expect(drawing()).toBeNull())
    expect(screen.getByLabelText('Show the picture')).toBeTruthy()
  })

  // Copy hands a picture to the machine's clipboard, which takes a photo and
  // nothing else, so a drawing is left without the row rather than with one that
  // does nothing.
  it('leaves the copy off a drawing', async () => {
    open('two.svg', 'logo.svg')
    render(createElement(BrowserPanel))
    await waitFor(() => expect(drawing()).not.toBeNull())

    fireEvent.contextMenu(document.querySelector('[data-image-frame]')!, { clientX: 40, clientY: 40 })

    expect(screen.queryByText('Copy image')).toBeNull()
  })

  it('reads a markdown file as the page, with the words a press away', async () => {
    open('three.md', 'notes.md', 'text/markdown')
    render(createElement(BrowserPanel))

    await waitFor(() => expect(document.querySelector('[data-markdown-page]')).not.toBeNull())

    fireEvent.click(screen.getByLabelText('Show the text'))

    await waitFor(() => expect(document.querySelector('[data-markdown-page]')).toBeNull())
    expect(screen.getByText('# Notes')).toBeTruthy()
  })

  // Everything else has one way to be read, so there is nothing to switch.
  it('offers nothing to switch on a file with one way to read it', async () => {
    open('four.txt', 'notes.txt')
    render(createElement(BrowserPanel))

    await waitFor(() => expect(screen.getByText('Plain words.')).toBeTruthy())
    expect(screen.queryByLabelText('Show the text')).toBeNull()
    expect(screen.queryByLabelText('Show the page')).toBeNull()
  })
})
