// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CrewPlugin } from '../src/shared/plugins'

Element.prototype.getAnimations ??= () => []

const kept = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => kept.set(key, value),
    removeItem: (key: string) => kept.delete(key),
    clear: () => kept.clear()
  }
})

class NoResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = NoResizeObserver as unknown as typeof ResizeObserver

class NoSocket {
  static OPEN = 1
  readyState = 0
  close(): void {}
  send(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}
globalThis.WebSocket = NoSocket as unknown as typeof WebSocket

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

const { PLUGIN_GROUPS, PLUGIN_OFFERS, offerOf } = await import('../src/shared/plugins')
const { PLUGIN_ART } = await import('../src/renderer/src/components/plugins/pluginArt')
const { useCrew } = await import('../src/renderer/src/state/store')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const PluginsView = (await import('../src/renderer/src/views/Plugins')).default

const held = (name: string): CrewPlugin => {
  const offer = offerOf(name)!
  return { ...offer, id: `id-${name}`, by: 'Jamel', ts: 1 }
}

const rowFor = (label: string): HTMLElement => screen.getByText(label).closest('div.group') as HTMLElement

const plugins = () => render(createElement(PluginsView))

describe('the plugins store', () => {
  beforeEach(() => {
    useCrew.setState({ plugins: [], addPlugin: () => null, removePlugin: () => {} })
    useBrowser.setState({ tabs: [], activeTabId: null, open: false, width: 480 })
  })

  afterEach(cleanup)

  it('offers what the crew can plug in, grouped, with nothing installed yet', () => {
    plugins()
    expect(screen.queryByText('Installed')).toBeNull()
    for (const offer of PLUGIN_OFFERS) expect(screen.getByText(offer.label)).toBeTruthy()
    for (const group of PLUGIN_GROUPS) expect(screen.getByText(group)).toBeTruthy()
  })

  it('wears the service own mark rather than a drawing of ours', () => {
    for (const offer of PLUGIN_OFFERS) expect(PLUGIN_ART[offer.name], offer.name).toBeTruthy()
  })

  it('adds the one a row names', () => {
    const added: unknown[] = []
    useCrew.setState({ addPlugin: one => (added.push(one), null) })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Add Figma' }))
    expect((added[0] as { name: string }).name).toBe('figma')
  })

  it('stands what is installed at the top and leaves it out of the offers below', () => {
    useCrew.setState({ plugins: [held('figma')] })
    plugins()
    expect(screen.getByText('Installed')).toBeTruthy()
    expect(screen.getAllByText('Figma')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Add Figma' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Take Figma out' })).toBeTruthy()
  })

  it('takes one out', () => {
    const gone: string[] = []
    useCrew.setState({ plugins: [held('figma')], removePlugin: id => gone.push(id) })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Take Figma out' }))
    expect(gone).toEqual(['id-figma'])
  })

  it('opens an installed plugin that has a page', () => {
    useCrew.setState({ plugins: [held('raylight')] })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Open Raylight' }))
    expect(useBrowser.getState().tabs).toEqual([
      expect.objectContaining({ plugin: 'raylight', initialUrl: 'https://www.raylight.app/projects' })
    ])
    expect(useBrowser.getState().open).toBe(true)
  })

  it('searches what is installed and what is offered together', () => {
    useCrew.setState({ plugins: [held('github')] })
    plugins()
    fireEvent.change(screen.getByLabelText('Search plugins'), { target: { value: 'figma' } })
    expect(screen.getByText('Figma')).toBeTruthy()
    expect(screen.queryByText('GitHub')).toBeNull()
    expect(screen.queryByText('Linear')).toBeNull()
  })

  it('says what a row does under its name', () => {
    plugins()
    expect(rowFor('Figma').textContent).toContain('Read a file, a frame or a component')
  })

  it('ends the list on the way to one of your own', () => {
    plugins()
    expect(screen.getByRole('button', { name: /Add one of your own/ })).toBeTruthy()
  })
})
