import { describe, expect, it } from 'vitest'
import { boardsPreamble, type DesignBoardMeta, type DesignPluginRef } from '../src/shared/design'
import { resolvePlugin } from '../src/shared/plugins'

const BOARD: DesignBoardMeta = { id: 'a1b2', name: 'Signup' }

const held = { name: 'frontpages' }
const renamed = { name: 'inspiration', catalogId: 'frontpages' }
const figma = { name: 'figma' }

const preamble = (plugins: DesignPluginRef[] = []) =>
  boardsPreamble('http://127.0.0.1:2739/abc', 'agent:1', BOARD, [], plugins) ?? ''

describe('the frontpages plugin', () => {
  it("resolves off the catalog rather than being taken as somebody's own server", () => {
    const plugin = resolvePlugin(held)
    expect(plugin.trusted).toBe(true)
    expect(plugin.transport).toBe('http')
    expect(plugin.authentication).toBe('none')
    expect(plugin.catalogTransport).toEqual({
      kind: 'http',
      protocol: 'streamable-http',
      url: 'https://ecagaenecamdrvwcsuaz.supabase.co/functions/v1/mcp-server'
    })
  })

  it('stands beside the chat on its own site', () => {
    const plugin = resolvePlugin(held)
    expect(plugin.launch.kind).toBe('browser')
    if (plugin.launch.kind !== 'browser') return
    expect(plugin.launch.url).toBe('https://frontpages.dev')
    expect(plugin.launch.routes[0].origin).toBe('https://frontpages.dev')
  })
})

describe('what a board tells an agent about frontpages', () => {
  it('names the tools it really has when the crew holds it', () => {
    const said = preamble([held])
    expect(said).toContain('search_frontpages')
    expect(said).toContain('get_categories')
    expect(said).toContain('get_frontpage')
    expect(said).toContain('every time')
  })

  it('says nothing about it when the crew does not', () => {
    const said = preamble()
    expect(said).toContain('design board "Signup"')
    expect(said.toLowerCase()).not.toContain('frontpages')
  })

  it('reads a plugin saved under another name by the catalog it came from', () => {
    expect(preamble([renamed])).toContain('search_frontpages')
    expect(preamble([figma])).not.toContain('search_frontpages')
  })
})
