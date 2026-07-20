import { describe, expect, it } from 'vitest'
import { Store } from '../src/server/store'
import { startHost, TestUi, tmpDir, waitUntil } from './helpers/session'

describe('doc pages', () => {
  it('renames a page on disk and broadcasts the change', async () => {
    const repoPath = tmpDir('docs-rename')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const watcher = await TestUi.connect(host.url, 'ana', host.code)

    ui.send({ type: 'doc.update', page: 'untitled', text: '# Notes' })
    ui.send({ type: 'doc.rename', from: 'untitled', to: 'meeting-notes' })
    await watcher.waitForEvent(e => e.kind === 'doc.renamed' && e.to === 'meeting-notes')

    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['meeting-notes'] === '# Notes')
    expect(store.loadDocs()['untitled']).toBeUndefined()

    ui.close()
    watcher.close()
    await host.close()
  })

  it('refuses to rename main or clobber an existing page', async () => {
    const repoPath = tmpDir('docs-rename-guard')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'doc.update', page: 'main', text: 'home' })
    ui.send({ type: 'doc.update', page: 'a', text: 'A' })
    ui.send({ type: 'doc.update', page: 'b', text: 'B' })
    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['b'] === 'B')

    ui.send({ type: 'doc.rename', from: 'main', to: 'renamed-main' })
    ui.send({ type: 'doc.rename', from: 'a', to: 'b' })
    await new Promise(r => setTimeout(r, 200))

    const docs = store.loadDocs()
    expect(docs['main']).toBe('home')
    expect(docs['renamed-main']).toBeUndefined()
    expect(docs['a']).toBe('A')
    expect(docs['b']).toBe('B')

    ui.close()
    await host.close()
  })
})
