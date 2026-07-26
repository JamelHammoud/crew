// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

const { useBrowser, DEFAULT_WIDTH } = await import('../src/renderer/src/state/browser')
const SidePanel = (await import('../src/renderer/src/components/SidePanel')).default

beforeEach(() => {
  useBrowser.setState({ tabs: [], activeTabId: null, width: DEFAULT_WIDTH })
  useBrowser.getState().openUrl('https://example.com')
})

const handleFor = (root: HTMLElement) => root.querySelector('.cursor-col-resize')!

const open = () => render(createElement(SidePanel, { visible: true }))

describe('the panel resize bar', () => {
  it('drags the panel to a new width', () => {
    const { container } = open()

    fireEvent.pointerDown(handleFor(container), { clientX: 800 })
    fireEvent.pointerMove(window, { clientX: 700 })
    fireEvent.pointerUp(window)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH + 100)
  })

  it('puts the width back to the default on a double click', () => {
    const { container } = open()
    useBrowser.getState().setWidth(760)

    fireEvent.doubleClick(handleFor(container))

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
  })

  it('leaves a panel that is already the default width where it is', () => {
    const { container } = open()

    fireEvent.doubleClick(handleFor(container))

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
  })
})
