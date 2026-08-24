// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { PathLocation } from '../src/shared/files'
import { pageUrl } from '../src/shared/urls'

const { useBrowser } = await import('../src/renderer/src/state/browser')
const { openShown } = await import('../src/renderer/src/components/openShown')

const named = (...paths: string[]): string[] =>
  paths.map(path => {
    const url = pageUrl(path)
    if (!url) throw new Error(`nothing would open ${path}`)
    return url
  })

const tabs = () => useBrowser.getState().tabs
const front = () => tabs().find(tab => tab.id === useBrowser.getState().activeTabId)

const locatePath = async (target: string): Promise<PathLocation> => {
  if (target.startsWith('/away/')) return { kind: 'private' }
  if (target.startsWith('/here/')) return { kind: 'repo', path: target.slice('/here/'.length), exists: true, dir: false }
  return { kind: 'local', exists: false, dir: false }
}

beforeEach(() => {
  window.crew = { locatePath } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
})

describe('what an agent shows', () => {
  it('reads a file in the file view rather than as a page in the browser', async () => {
    await openShown(named('/here/src/theme.css'))

    expect(tabs()).toHaveLength(1)
    expect(tabs()[0].kind).toBe('file')
    expect(tabs()[0].path).toBe('src/theme.css')
    expect(useBrowser.getState().open).toBe(true)
  })

  it('opens a file the way it is written to be read', async () => {
    await openShown(named('/here/site/index.html'))
    expect(front()?.preview).toBe(true)

    await openShown(named('/here/notes/plan.md'))
    expect(front()?.preview).toBe(true)

    await openShown(named('/here/src/app.ts'))
    expect(front()?.preview).toBe(false)
  })

  it('opens everything one call named, in the order it named them, and stands on the first', async () => {
    await openShown(named('/here/a/one.ts', '/here/a/two.ts', '/here/a/three.ts'))

    expect(tabs().map(tab => tab.path)).toEqual(['a/one.ts', 'a/two.ts', 'a/three.ts'])
    expect(front()?.path).toBe('a/one.ts')
  })

  it('takes a file to the file view and an address to the browser in the same call', async () => {
    await openShown([...named('/here/api/server.ts'), 'http://localhost:5173'])

    expect(tabs().map(tab => tab.kind)).toEqual(['file', 'web'])
    expect(tabs()[1].url).toBe('http://localhost:5173')
    expect(front()?.path).toBe('api/server.ts')
  })

  it('leaves a file nobody here can follow alone, and opens the rest', async () => {
    await openShown(named('/away/secret/notes.md', '/here/src/read.ts'))

    expect(tabs()).toHaveLength(1)
    expect(tabs()[0].path).toBe('src/read.ts')
    expect(front()?.path).toBe('src/read.ts')
  })

  it('reads a file again where a tab is already standing on it', async () => {
    await openShown(named('/here/src/again.ts'))
    const before = tabs()[0]
    useBrowser.getState().closePanel()

    await openShown(named('/here/src/again.ts'))

    expect(tabs()).toHaveLength(1)
    expect(tabs()[0].generation).toBe(before.generation + 1)
    expect(useBrowser.getState().open).toBe(true)
  })
})
