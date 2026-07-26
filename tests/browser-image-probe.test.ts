// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

const { isImageUrl } = await import('../src/shared/files')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default

const ATTACHMENT = 'http://192.168.139.3:2739/attachments/bddedeb9-da97-493f-8b0d-659360345cfa.jpg'

beforeEach(() => useBrowser.setState({ tabs: [], activeTabId: null }))

describe('a picture opened in a browser tab', () => {
  it('tells an image address from a page', () => {
    expect(isImageUrl(ATTACHMENT)).toBe(true)
    expect(isImageUrl('http://host/a/b.PNG?v=2')).toBe(true)
    expect(isImageUrl('https://example.com/photos')).toBe(false)
    expect(isImageUrl('https://example.com/page.html')).toBe(false)
  })

  it('opens in the viewer crew draws itself, never a web page', () => {
    useBrowser.getState().openUrl(ATTACHMENT)
    const { container } = render(createElement(BrowserPanel))

    expect(container.querySelector('webview')).toBeNull()
    expect(container.querySelector('[data-image-frame]')).not.toBeNull()
    expect(container.querySelector(`img[src="${ATTACHMENT}"]`)).not.toBeNull()
  })

  it('leaves a web address to the web view', () => {
    useBrowser.getState().openUrl('https://example.com/page.html')
    const { container } = render(createElement(BrowserPanel))

    expect(container.querySelector('webview')).not.toBeNull()
    expect(container.querySelector('[data-image-frame]')).toBeNull()
  })

  it('names the tab after the picture', () => {
    useBrowser.getState().openUrl(ATTACHMENT)
    const { container } = render(createElement(BrowserPanel))

    expect(container.textContent).toContain('bddedeb9-da97-493f-8b0d-659360345cfa.jpg')
  })

  it('reloads a picture without a web view to ask', () => {
    useBrowser.getState().openUrl(ATTACHMENT)
    const before = useBrowser.getState().tabs[0]!
    useBrowser.getState().reloadTab(before.id)

    expect(useBrowser.getState().tabs[0]!.generation).toBe(before.generation + 1)
  })
})
