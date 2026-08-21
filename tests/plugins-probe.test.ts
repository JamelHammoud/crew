// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const { installPlugin, PLUGIN_GROUPS, PLUGIN_OFFERS, offerOf } = await import('../src/shared/plugins')
const { PLUGIN_ART } = await import('../src/renderer/src/components/plugins/pluginArt')
const { useCrew } = await import('../src/renderer/src/state/store')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const { usePluginConnections } = await import('../src/renderer/src/state/pluginConnections')
const PluginsView = (await import('../src/renderer/src/views/Plugins')).default

const held = (name: string): CrewPlugin => {
  const offer = offerOf(name)!
  return { ...installPlugin(offer), id: `id-${name}`, by: 'Jamel', ts: 1 }
}

const rowFor = (label: string): HTMLElement => screen.getByText(label).closest('div.group') as HTMLElement

const plugins = () => render(createElement(PluginsView))

describe('the plugins store', () => {
  beforeEach(() => {
    useCrew.setState({ plugins: [], installPlugin: async () => null, addPlugin: () => null, removePlugin: () => {} })
    useBrowser.setState({ tabs: [], activeTabId: null, open: false, width: 480 })
    usePluginConnections.setState({ ids: [] })
    window.crew = {
      connectPlugin: vi.fn().mockResolvedValue({ ok: true, message: 'Connected.' })
    } as unknown as CrewBridge
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

  it('connects and then adds the one a row names', async () => {
    const added: unknown[] = []
    useCrew.setState({ installPlugin: async one => (added.push(one), null) })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Add Figma' }))
    await waitFor(() => expect(added).toHaveLength(1))
    expect(window.crew.connectPlugin).toHaveBeenCalledOnce()
    expect(added[0]).toMatchObject({ name: 'figma', installationVersion: 2 })
  })

  it('keeps the row working until the connection is verified', async () => {
    let finish = (_result: { ok: boolean; message: string }) => {}
    window.crew.connectPlugin = vi.fn().mockReturnValue(
      new Promise(resolve => {
        finish = resolve
      })
    )
    const added: unknown[] = []
    useCrew.setState({ installPlugin: async one => (added.push(one), null) })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Add Canva' }))
    expect(screen.getByRole('status', { name: 'Working' })).toBeTruthy()
    expect(added).toEqual([])
    finish({ ok: true, message: 'Canva is connected.' })
    await waitFor(() => expect(added).toHaveLength(1))
  })

  it('keeps a failed connection available and says what happened', async () => {
    window.crew.connectPlugin = vi.fn().mockResolvedValue({ ok: false, message: 'Canva did not connect.' })
    const installPlugin = vi.fn(async () => null)
    useCrew.setState({ installPlugin })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Add Canva' }))
    await screen.findByText('Canva did not connect.')
    expect(installPlugin).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add Canva' })).toBeTruthy()
  })

  it('disconnects when the crew rejects the install after approval', async () => {
    const disconnectPlugin = vi.fn().mockResolvedValue(undefined)
    window.crew = {
      connectPlugin: vi.fn().mockResolvedValue({ ok: true, message: 'Canva is connected.' }),
      disconnectPlugin
    } as unknown as CrewBridge
    useCrew.setState({ installPlugin: async () => 'The crew already has that one.' })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Add Canva' }))
    await screen.findByText('The crew already has that one.')
    expect(disconnectPlugin).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Add Canva' })).toBeTruthy()
  })

  it('connects an existing crew plugin on this computer without adding it twice', async () => {
    const figma = held('figma')
    window.crew = {
      connectPlugin: vi.fn().mockResolvedValue({ ok: true, message: 'Figma is connected.' }),
      pluginStatus: vi.fn().mockResolvedValue(false)
    } as unknown as CrewBridge
    const installPlugin = vi.fn(async () => null)
    useCrew.setState({ plugins: [figma], installPlugin })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Connect Figma' }))
    await waitFor(() => expect(window.crew.connectPlugin).toHaveBeenCalledOnce())
    expect(window.crew.connectPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ installationId: figma.installationId })
    )
    expect(installPlugin).not.toHaveBeenCalled()
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

  it('opens a legacy installed plugin from current catalog data', () => {
    const { appUrl: _appUrl, ...legacy } = held('raylight')
    useCrew.setState({ plugins: [{ ...legacy, label: 'Old Raylight', blurb: 'Old copy' }] })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Open Raylight' }))
    expect(useBrowser.getState().tabs).toEqual([
      expect.objectContaining({ plugin: 'raylight', initialUrl: 'https://www.raylight.app/projects' })
    ])
    expect(useBrowser.getState().open).toBe(true)
    expect(screen.getByText('Make and edit product videos')).toBeTruthy()
  })

  it('opens the trusted page for an installed service plugin', () => {
    useCrew.setState({ plugins: [held('figma')] })
    plugins()
    fireEvent.click(screen.getByRole('button', { name: 'Open Figma' }))
    expect(useBrowser.getState().tabs).toEqual([
      expect.objectContaining({
        initialUrl: 'https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Dev-Mode-MCP-Server'
      })
    ])
  })

  it('searches what is installed and what is offered together', () => {
    useCrew.setState({ plugins: [held('raylight')] })
    plugins()
    fireEvent.change(screen.getByLabelText('Search plugins'), { target: { value: 'figma' } })
    expect(screen.getByText('Figma')).toBeTruthy()
    expect(screen.queryByText('GitHub')).toBeNull()
    expect(screen.queryByText('Linear')).toBeNull()
  })

  it('says what a row does under its name', () => {
    plugins()
    expect(rowFor('Figma').textContent).toContain('Read whatever is open in the desktop app')
  })

  it('ends the list on the way to one of your own', () => {
    plugins()
    expect(screen.getByRole('button', { name: /Add one of your own/ })).toBeTruthy()
  })
})
