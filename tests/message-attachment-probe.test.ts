// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Attachment } from '../src/shared/attachments'

const openExternal = vi.fn()
const copyImage = vi.fn()

window.crew = { openExternal, copyImage } as unknown as typeof window.crew

const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useCrew } = await import('../src/renderer/src/state/store')
const MessageAttachments = (await import('../src/renderer/src/components/MessageAttachments')).default

const BASE = 'http://127.0.0.1:2739'

const picture: Attachment = {
  id: 'a',
  name: 'balance.png',
  mime: 'image/png',
  size: 8_192,
  file: 'a.png'
}

const paper: Attachment = {
  id: 'b',
  name: 'terms.pdf',
  mime: 'application/pdf',
  size: 291_000,
  file: 'b.pdf'
}

const folded: Attachment = {
  id: 'c',
  name: 'shots.zip',
  mime: 'application/zip',
  size: 4_400_000,
  file: 'c.zip'
}

const draw = (attachments: Attachment[]) => render(createElement(MessageAttachments, { attachments }))

beforeEach(() => {
  openExternal.mockClear()
  copyImage.mockReset().mockResolvedValue(true)
  useBrowser.setState({ tabs: [], activeTabId: null })
  useCrew.setState({ httpBase: BASE })
})

afterEach(cleanup)

describe('a message carrying a picture and a file', () => {
  it('draws the picture and never draws the file as one', () => {
    const { container } = draw([picture, paper])
    const images = container.querySelectorAll('img')

    expect(images).toHaveLength(1)
    expect(images[0]!.getAttribute('src')).toBe(`${BASE}/attachments/a.png`)
  })

  it('says what the file is called and what it weighs', () => {
    const { getByLabelText } = draw([picture, paper])
    const row = getByLabelText('Open terms.pdf')

    expect(row.textContent).toContain('terms.pdf')
    expect(row.textContent).toContain('291 KB')
    expect(row.querySelector('img')).toBeNull()
    expect(row.querySelector('svg')).not.toBeNull()
  })

  it('opens a file in the panel', () => {
    const { getByLabelText } = draw([paper])
    fireEvent.click(getByLabelText('Open terms.pdf'))

    const { tabs } = useBrowser.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0]!.initialUrl).toBe(`${BASE}/attachments/b.pdf`)
    expect(openExternal).not.toHaveBeenCalled()
  })

  // Whatever it is, it opens where everything else does, and handing it to the
  // machine is a button on the panel rather than what a click does.
  it('opens one the app has to read for itself in the panel too', () => {
    const { getByLabelText } = draw([folded])
    fireEvent.click(getByLabelText('Open shots.zip'))

    expect(useBrowser.getState().tabs[0]).toMatchObject({
      kind: 'attachment',
      initialUrl: `${BASE}/attachments/c.zip`,
      title: 'shots.zip',
      mime: 'application/zip',
      size: 4_400_000
    })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('opens a picture from the message it was sent in', () => {
    const { getByLabelText } = draw([picture])
    fireEvent.click(getByLabelText('Open balance.png'))

    expect(useBrowser.getState().tabs[0]).toMatchObject({
      kind: 'attachment',
      initialUrl: `${BASE}/attachments/a.png`,
      mime: 'image/png'
    })
  })

  it('copies a picture from its preview without opening it', () => {
    const parentMenu = vi.fn()
    const { getByLabelText, getByText } = render(
      createElement(
        'div',
        { onContextMenu: parentMenu },
        createElement(MessageAttachments, { attachments: [picture] })
      )
    )

    fireEvent.contextMenu(getByLabelText('Open balance.png'), { clientX: 44, clientY: 72 })
    fireEvent.click(getByText('Copy image'))

    expect(copyImage).toHaveBeenCalledWith(`${BASE}/attachments/a.png`)
    expect(useBrowser.getState().tabs).toHaveLength(0)
    expect(parentMenu).not.toHaveBeenCalled()
  })

  it('is nothing at all when the message carries nothing', () => {
    const { container } = draw([])

    expect(container.firstChild).toBeNull()
  })
})
