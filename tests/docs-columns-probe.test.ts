// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

class Watcher {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = Watcher as unknown as typeof ResizeObserver

const { default: Docs } = await import('../src/renderer/src/views/Docs')
const { default: SidebarDocs } = await import('../src/renderer/src/components/sidebar/SidebarDocs')
const { useDocs } = await import('../src/renderer/src/state/docs')
const { useHeaderSlot } = await import('../src/renderer/src/state/headerSlot')
const { useCrew } = await import('../src/renderer/src/state/store')

const stock = (page: string): void => {
  useCrew.setState({
    docs: {
      welcome: { title: 'Welcome', text: 'Hello' },
      'handbook-a1b2': { title: 'The handbook', text: 'The parent' },
      'handbook-a1b2/setup-c3d4': { title: 'Setting up', text: 'How to get going' }
    },
    docsTarget: page
  })
}

const header = (): HTMLElement => {
  const node = document.createElement('div')
  document.body.append(node)
  useHeaderSlot.getState().hold.left(node)
  return node
}

afterEach(cleanup)

describe('the docs page under the header', () => {
  it('says which page you are in on the header row rather than over the writing', () => {
    const left = header()
    stock('handbook-a1b2/setup-c3d4')
    const { container } = render(createElement(Docs))
    const trail = left.querySelector('[data-docs-trail]')
    expect(trail?.textContent).toContain('The handbook')
    expect(container.querySelector('[data-docs-trail]')).toBeNull()
  })

  it('leaves the row to the page when there is nowhere above it to go', () => {
    const left = header()
    stock('welcome')
    render(createElement(Docs))
    expect(left.querySelector('[data-docs-trail]')).toBeNull()
  })

  it('leaves the list of pages to the rail rather than drawing one of its own', () => {
    header()
    stock('welcome')
    const { container } = render(createElement(Docs))
    expect(container.querySelector('[data-docs-tree]')).toBeNull()
  })
})

describe('the list of pages in the rail', () => {
  it('lights the page you are reading the way every other list in the app does', () => {
    stock('welcome')
    useDocs.getState().open('welcome')
    const { container } = render(createElement(SidebarDocs, { open: true }))
    const list = container.querySelector('[data-docs-tree]')!
    const lit = list.querySelector('[aria-current="page"]')!
    expect(lit.textContent).toContain('Welcome')
    expect(lit.parentElement!.className).toContain('bg-fg/[0.10]')
    expect(list.innerHTML).not.toContain('bg-ink-800')
  })
})
