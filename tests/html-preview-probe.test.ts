// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import { useBrowser } from '../src/renderer/src/state/browser'
import { canPreview, isHtml, type RepoFile } from '../src/shared/files'
import { baseUrl, fileUrl, withBase } from '../src/shared/htmlPage'

if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}

const PAGE = `<!doctype html>
<html>
  <head><title>Signup</title></head>
  <body><h1>Sign up</h1></body>
</html>
`

const CUT = `<!doctype html>
<html>
  <head><title>The stand</title></head>
  <body><canvas id="scene"></canvas><script>const model = {`

const repo: Record<string, RepoFile> = {
  'site/index.html': { kind: 'file', path: 'site/index.html', text: PAGE, truncated: false },
  'site/model.html': { kind: 'file', path: 'site/model.html', text: CUT, truncated: true },
  'site/many.html': {
    kind: 'file',
    path: 'site/many.html',
    text: `${PAGE}${'<p>a line</p>\n'.repeat(6000)}`,
    truncated: false
  },
  'readme.md': { kind: 'file', path: 'readme.md', text: '# Notes\n', truncated: false },
  'src/app.ts': { kind: 'file', path: 'src/app.ts', text: 'const one = 1\n', truncated: false }
}

let stood: { id: string; path: string; text: string | null }[] = []
let dropped: string[] = []
let made = 0

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null })
  stood = []
  dropped = []
  made = 0
  Element.prototype.scrollIntoView = () => undefined
  window.crew = {
    readFile: async (path: string) => repo[path] ?? { kind: 'missing', path },
    listFiles: async () => Object.keys(repo),
    writeFile: async () => null,
    previewHtml: async (id: string, path: string, text: string | null) => {
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

describe('reading an html file as the page it is written to be', () => {
  it('tells a page from a file by its name', () => {
    expect(isHtml('site/index.html')).toBe(true)
    expect(isHtml('one.htm')).toBe(true)
    expect(isHtml('INDEX.HTML')).toBe(true)
    expect(isHtml('src/app.ts')).toBe(false)
    expect(isHtml('html')).toBe(false)
    expect(canPreview('site/index.html')).toBe(true)
    expect(canPreview('readme.md')).toBe(true)
    expect(canPreview('src/app.ts')).toBe(false)
  })

  it('offers the preview on an html file and nowhere else', async () => {
    useBrowser.getState().openFile('src/app.ts')
    render(createElement(BrowserPanel))
    await waitFor(() => expect(screen.getByLabelText('File contents')).toBeTruthy())

    expect(screen.queryByLabelText('Show preview')).toBeNull()

    useBrowser.getState().openFile('site/index.html')

    expect(await screen.findByLabelText('Show preview')).toBeTruthy()
  })

  it('draws the page in place of the code, and the code again on the way back', async () => {
    useBrowser.getState().openFile('site/index.html')
    render(createElement(BrowserPanel))

    fireEvent.click(await screen.findByLabelText('Show preview'))

    await waitFor(() => expect(page()).not.toBeNull())
    expect(page()!.getAttribute('src')).toBe('file:///tmp/crew-previews/page-1.html')
    expect(screen.queryByLabelText('File contents')).toBeNull()

    fireEvent.click(screen.getByLabelText('Hide preview'))

    await waitFor(() => expect(page()).toBeNull())
    expect(screen.getByLabelText('File contents')).toBeTruthy()
  })

  it('draws a page too big to hold from the file rather than from the head of it', async () => {
    useBrowser.getState().openFile('site/model.html')
    render(createElement(BrowserPanel))

    fireEvent.click(await screen.findByLabelText('Show preview'))

    await waitFor(() => expect(stood.length).toBe(1))
    expect(stood[0].path).toBe('site/model.html')
    expect(stood[0].text).toBeNull()
  })

  it('says nothing about the beginning of a file over a page', async () => {
    useBrowser.getState().openFile('site/model.html')
    render(createElement(BrowserPanel))

    expect(await screen.findByText('Showing the beginning of this file')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Show preview'))

    await waitFor(() => expect(page()).not.toBeNull())
    expect(screen.queryByText('Showing the beginning of this file')).toBeNull()
  })

  it('draws a page of many lines whole, since the text view is the only thing that cuts them', async () => {
    useBrowser.getState().openFile('site/many.html')
    render(createElement(BrowserPanel))

    fireEvent.click(await screen.findByLabelText('Show preview'))

    await waitFor(() => expect(stood.length).toBe(1))
    expect(stood[0].text).toBeNull()
  })

  it('draws the page from what is in hand, edits and all', async () => {
    useBrowser.getState().openFile('site/index.html')
    render(createElement(BrowserPanel))
    const area = await screen.findByLabelText('File contents')

    fireEvent.change(area, { target: { value: '<h1>Written just now</h1>\n' } })
    fireEvent.click(screen.getByLabelText('Show preview'))

    await waitFor(() => expect(stood.length).toBe(1))
    expect(stood[0].path).toBe('site/index.html')
    expect(stood[0].text).toBe('<h1>Written just now</h1>\n')
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('takes the page away again when it is done with', async () => {
    useBrowser.getState().openFile('site/index.html')
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByLabelText('Show preview'))
    await waitFor(() => expect(page()).not.toBeNull())

    expect(dropped).toEqual([])

    fireEvent.click(screen.getByLabelText('Hide preview'))

    await waitFor(() => expect(dropped).toEqual([stood[0].id]))
  })

  it('keeps the way it is read while walking from one page to the next', async () => {
    useBrowser.getState().openFile('site/index.html')
    render(createElement(BrowserPanel))
    fireEvent.click(await screen.findByLabelText('Show preview'))
    await waitFor(() => expect(page()).not.toBeNull())

    const { tabs, activeTabId } = useBrowser.getState()
    expect(tabs.find(tab => tab.id === activeTabId)!.preview).toBe(true)
  })
})

describe('what a page beside itself can still reach', () => {
  it('names a file as an address the app can load', () => {
    expect(fileUrl('/Users/one/site/index.html')).toBe('file:///Users/one/site/index.html')
    expect(fileUrl('/Users/one/my site/index.html')).toBe('file:///Users/one/my%20site/index.html')
    expect(fileUrl('C:\\Users\\one\\site\\index.html')).toBe('file:///C:/Users/one/site/index.html')
  })

  it('reads the folder the page really lives in', () => {
    expect(baseUrl('/Users/one/site/index.html')).toBe('file:///Users/one/site/')
    expect(baseUrl('/index.html')).toBe('file:///')
  })

  it('hands the page that folder', () => {
    expect(withBase('<html><head><title>a</title></head></html>', 'file:///s/')).toBe(
      '<html><head><base href="file:///s/"><title>a</title></head></html>'
    )
    expect(withBase('<html><body>a</body></html>', 'file:///s/')).toBe(
      '<html><base href="file:///s/"><body>a</body></html>'
    )
    expect(withBase('<!doctype html>\n<p>a</p>', 'file:///s/')).toBe(
      '<!doctype html><base href="file:///s/">\n<p>a</p>'
    )
    expect(withBase('<p>a</p>', 'file:///s/')).toBe('<base href="file:///s/"><p>a</p>')
  })

  it('leaves a page that says its own folder alone', () => {
    const said = '<html><head><base href="https://example.com/"></head></html>'
    expect(withBase(said, 'file:///s/')).toBe(said)
    expect(withBase('<p>a</p>', '')).toBe('<p>a</p>')
  })
})

describe('a page that is only partly in hand', () => {
  let folder = ''

  beforeEach(async () => {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'crew-page-'))
  })

  afterEach(async () => {
    await fs.rm(folder, { recursive: true, force: true })
  })

  it('stands where it was written rather than in a copy of its own head', async () => {
    const wrote = path.join(folder, 'model.html')
    await fs.writeFile(wrote, '<html><body><canvas></canvas><script>draw()</script></body></html>', 'utf8')
    const previews = new Previews()

    expect(await previews.show('one', wrote, null)).toBe(fileUrl(wrote))
    previews.clear()
  })

  it('writes out the words wherever they are the whole of the file', async () => {
    const wrote = path.join(folder, 'index.html')
    const previews = new Previews()

    const url = await previews.show('one', wrote, '<p>Written just now</p>')
    expect(url).not.toBe(fileUrl(wrote))
    expect(url!.startsWith('file://')).toBe(true)
    previews.clear()
  })

  it('takes the copy it had away when the same page turns out to be too big', async () => {
    const wrote = path.join(folder, 'index.html')
    const previews = new Previews()

    const url = await previews.show('one', wrote, '<p>a</p>')
    const copy = decodeURIComponent(url!.slice('file://'.length))
    expect(fsSync.existsSync(copy)).toBe(true)

    await previews.show('one', wrote, null)
    expect(fsSync.existsSync(copy)).toBe(false)
  })

  it('has nothing to stand up for a page with no file behind it', async () => {
    const previews = new Previews()
    expect(await previews.show('one', '', null)).toBeNull()
  })
})
