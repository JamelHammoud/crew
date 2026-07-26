// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useCrew } = await import('../src/renderer/src/state/store')
const { AttachmentTray } = await import('../src/renderer/src/components/Attachments')
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default

const KEY = 'chat'
const PIXEL = 'iVBORw0KGgo='
const SRC = `data:image/png;base64,${PIXEL}`

const draft = (id: string, name: string) => ({ id, name, mime: 'image/png', data: PIXEL, size: 8 })

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null })
  useCrew.setState({ pending: { [KEY]: [draft('a', 'balance.png')] } })
})

afterEach(cleanup)

describe('an image that has not been sent yet', () => {
  it('opens in the viewer when it is clicked', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(getByLabelText('Open balance.png'))

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0]!.kind).toBe('image')
    expect(tabs[0]!.initialUrl).toBe(SRC)
  })

  it('is drawn by crew, under the name of the file, never as a web page', () => {
    const tray = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(tray.getByLabelText('Open balance.png'))
    const { container } = render(createElement(BrowserPanel))

    expect(container.querySelector('webview')).toBeNull()
    expect(container.querySelector('[data-image-frame]')).not.toBeNull()
    expect(container.querySelector(`img[src="${SRC}"]`)).not.toBeNull()
    expect(container.textContent).toContain('balance.png')
  })

  it('stays attached to the message being written', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(getByLabelText('Open balance.png'))

    expect(useCrew.getState().pending[KEY]).toHaveLength(1)
  })

  it('opens the tab it already has rather than another one', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(getByLabelText('Open balance.png'))
    useBrowser.getState().addTab()
    fireEvent.click(getByLabelText('Open balance.png'))

    const { tabs, activeTabId } = useBrowser.getState()
    expect(tabs.filter(t => t.kind === 'image')).toHaveLength(1)
    expect(tabs.find(t => t.id === activeTabId)!.kind).toBe('image')
  })

  it('hangs the remove tooltip on the button rather than on the flow', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    const anchor = getByLabelText('Remove balance.png').parentElement!

    expect(anchor.className).toContain('absolute')
    expect(getByLabelText('Open balance.png').className).not.toContain('absolute')
  })

  it('can still be taken off the message', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(getByLabelText('Remove balance.png'))

    expect(useCrew.getState().pending[KEY]).toHaveLength(0)
    expect(useBrowser.getState().tabs).toHaveLength(0)
  })
})
