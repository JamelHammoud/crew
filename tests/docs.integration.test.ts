import fs from 'node:fs'
import path from 'node:path'
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
    await waitUntil(() => store.loadDocs()['meeting-notes']?.text === '# Notes')
    expect(store.loadDocs()['untitled']).toBeUndefined()

    ui.close()
    watcher.close()
    await host.close()
  })

  it('moves a page with its sub-pages when nested', async () => {
    const repoPath = tmpDir('docs-subpages')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'doc.update', page: 'guides', text: 'Guides' })
    ui.send({ type: 'doc.update', page: 'guides/setup', text: 'Setup' })
    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['guides/setup']?.text === 'Setup')

    ui.send({ type: 'doc.rename', from: 'guides', to: 'handbook/guides' })
    await ui.waitForEvent(e => e.kind === 'doc.renamed' && e.to === 'handbook/guides')
    await waitUntil(() => store.loadDocs()['handbook/guides/setup']?.text === 'Setup')
    const docs = store.loadDocs()
    expect(docs['handbook/guides']?.text).toBe('Guides')
    expect(docs['guides']).toBeUndefined()
    expect(docs['guides/setup']).toBeUndefined()

    ui.close()
    await host.close()
  })

  it('schedules a git sync when docs are saved or renamed', async () => {
    const repoPath = tmpDir('docs-sync')
    const host = await startHost(repoPath)
    let syncs = 0
    host.session.onSyncNeeded = () => syncs++
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    ui.send({ type: 'doc.update', page: 'notes', text: 'hi' })
    await waitUntil(() => new Store(repoPath).loadDocs()['notes']?.text === 'hi')
    const afterSave = syncs
    ui.send({ type: 'doc.rename', from: 'notes', to: 'journal' })
    await ui.waitForEvent(e => e.kind === 'doc.renamed')
    expect(afterSave).toBeGreaterThan(0)
    expect(syncs).toBeGreaterThan(afterSave)

    ui.close()
    await host.close()
  })

  it('deletes a page and its sub-pages', async () => {
    const repoPath = tmpDir('docs-delete')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'doc.update', page: 'main', text: 'home' })
    ui.send({ type: 'doc.update', page: 'scratch', text: 'S' })
    ui.send({ type: 'doc.update', page: 'scratch/child', text: 'C' })
    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['scratch/child']?.text === 'C')

    ui.send({ type: 'doc.delete', page: 'scratch' })
    await ui.waitForEvent(e => e.kind === 'doc.deleted' && e.page === 'scratch')
    await waitUntil(() => store.loadDocs()['scratch'] === undefined)
    expect(store.loadDocs()['scratch/child']).toBeUndefined()

    ui.send({ type: 'doc.delete', page: 'main' })
    await new Promise(r => setTimeout(r, 150))
    expect(host.session.snapshot().docs['main']).not.toBeUndefined()

    ui.close()
    await host.close()
  })

  it('redirects a stale save that lands right after a rename', async () => {
    const repoPath = tmpDir('docs-stale-save')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'doc.update', page: 'draft', text: 'v1' })
    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['draft']?.text === 'v1')

    ui.send({ type: 'doc.rename', from: 'draft', to: 'final' })
    ui.send({ type: 'doc.update', page: 'draft', text: 'v2' })
    await waitUntil(() => store.loadDocs()['final']?.text === 'v2')
    expect(store.loadDocs()['draft']).toBeUndefined()

    ui.close()
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
    await waitUntil(() => store.loadDocs()['b']?.text === 'B')

    ui.send({ type: 'doc.rename', from: 'main', to: 'renamed-main' })
    ui.send({ type: 'doc.rename', from: 'a', to: 'b' })
    await new Promise(r => setTimeout(r, 200))

    const docs = store.loadDocs()
    expect(docs['main']?.text).toBe('home')
    expect(docs['renamed-main']).toBeUndefined()
    expect(docs['a']?.text).toBe('A')
    expect(docs['b']?.text).toBe('B')

    ui.close()
    await host.close()
  })

  it('retitles main with special characters and keeps the title on disk', async () => {
    const repoPath = tmpDir('docs-retitle')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const watcher = await TestUi.connect(host.url, 'ana', host.code)

    ui.send({ type: 'doc.update', page: 'main', text: 'home' })
    ui.send({ type: 'doc.retitle', page: 'main', title: 'Home: plans & ideas (2026)!' })
    await watcher.waitForEvent(e => e.kind === 'doc' && e.title === 'Home: plans & ideas (2026)!')

    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['main']?.title === 'Home: plans & ideas (2026)!')
    expect(store.loadDocs()['main']?.text).toBe('home')
    expect(host.session.snapshot().docs['main']?.title).toBe('Home: plans & ideas (2026)!')

    ui.close()
    watcher.close()
    await host.close()
  })

  it('lets two pages share a title under different file names', async () => {
    const repoPath = tmpDir('docs-same-title')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'doc.update', page: 'notes-1abc', text: 'A', title: 'Notes' })
    ui.send({ type: 'doc.update', page: 'notes-2xyz', text: 'B', title: 'Notes' })
    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['notes-2xyz']?.text === 'B')

    const docs = store.loadDocs()
    expect(docs['notes-1abc']).toEqual({ title: 'Notes', text: 'A' })
    expect(docs['notes-2xyz']).toEqual({ title: 'Notes', text: 'B' })

    ui.close()
    await host.close()
  })

  it('carries a new title through a rename', async () => {
    const repoPath = tmpDir('docs-rename-title')
    const host = await startHost(repoPath)
    const ui = await TestUi.connect(host.url, 'sam', host.code)

    ui.send({ type: 'doc.update', page: 'untitled-1aaa', text: 'X', title: '' })
    ui.send({ type: 'doc.rename', from: 'untitled-1aaa', to: 'plan-1aaa', title: 'Plan!' })
    await ui.waitForEvent(e => e.kind === 'doc.renamed' && e.to === 'plan-1aaa' && e.title === 'Plan!')

    const store = new Store(repoPath)
    await waitUntil(() => store.loadDocs()['plan-1aaa']?.title === 'Plan!')
    expect(store.loadDocs()['plan-1aaa']?.text).toBe('X')
    expect(store.loadDocs()['untitled-1aaa']).toBeUndefined()

    ui.close()
    await host.close()
  })

  it('reads files saved before titles existed', async () => {
    const repoPath = tmpDir('docs-legacy')
    fs.mkdirSync(path.join(repoPath, '.crew', 'docs'), { recursive: true })
    fs.writeFileSync(path.join(repoPath, '.crew', 'docs', 'old-page.md'), '# Old\n\nStill here.')
    const host = await startHost(repoPath)

    const docs = host.session.snapshot().docs
    expect(docs['old-page']).toEqual({ title: 'Old page', text: '# Old\n\nStill here.' })

    await host.close()
  })
})
