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

const paper = { id: 'b', name: 'terms.pdf', mime: 'application/pdf', data: 'JVBERi0=', size: 291_000 }

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null })
  useCrew.setState({ pending: { [KEY]: [draft('a', 'balance.png')] } })
  URL.createObjectURL ??= () => 'blob:pending'
})

afterEach(cleanup)

describe('an image that has not been sent yet', () => {
  it('opens in the viewer when it is clicked', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(getByLabelText('Open balance.png'))

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0]!.kind).toBe('attachment')
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
    expect(tabs.filter(t => t.kind === 'attachment')).toHaveLength(1)
    expect(tabs.find(t => t.id === activeTabId)!.kind).toBe('attachment')
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

describe('a file that has not been sent yet', () => {
  beforeEach(() => {
    useCrew.setState({ pending: { [KEY]: [draft('a', 'balance.png'), paper] } })
  })

  it('stands as its name and its weight rather than as a broken picture', () => {
    const { container, getByText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))

    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(getByText('terms.pdf')).not.toBeNull()
    expect(getByText('291 KB')).not.toBeNull()
  })

  it('sits at the height the thumbnails do', () => {
    const { container, getByText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    const thumbnail = container.querySelector('img')!.parentElement!
    const chip = getByText('terms.pdf').closest('button')!

    expect(thumbnail.className).toContain('h-16')
    expect(chip.className).toContain('h-16')
  })

  // Every file in the tray opens where a picture does, so nothing sitting on a
  // message being written is a box that cannot be looked at.
  it('opens in the panel the way a picture does', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(getByLabelText('Open terms.pdf'))

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toMatchObject({ kind: 'attachment', title: 'terms.pdf', mime: 'application/pdf' })
  })

  it('comes off the message the same way a picture does', () => {
    const { getByLabelText } = render(createElement(AttachmentTray, { attachmentKey: KEY }))
    fireEvent.click(getByLabelText('Remove terms.pdf'))

    expect(useCrew.getState().pending[KEY]!.map(item => item.name)).toEqual(['balance.png'])
  })
})
