import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { StickyStore } from '../src/main/stickies-store'

function userData(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crew-stickies-'))
}

describe('sticky store', () => {
  it('creates, updates, deletes, and reads stickies back from user data', () => {
    const directory = userData()
    let now = 10
    const store = new StickyStore(directory, () => now)

    expect(store.list()).toEqual([])
    const made = store.create({ title: '  Today  ', body: '- buy milk', color: 'blue' })
    expect(made).toEqual({
      id: expect.any(String),
      title: 'Today',
      body: '- buy milk',
      color: 'blue',
      pinned: false,
      createdAt: 10,
      updatedAt: 10
    })

    now = 20
    const changed = store.update(made.id, { title: '', body: '**done**', pinned: true })
    expect(changed).toEqual({
      id: made.id,
      body: '**done**',
      color: 'blue',
      pinned: true,
      createdAt: 10,
      updatedAt: 20
    })
    expect(new StickyStore(directory).list()).toEqual([changed])
    expect(store.delete(made.id)).toBe(true)
    expect(store.delete(made.id)).toBe(false)
    expect(new StickyStore(directory).list()).toEqual([])
  })

  it('orders pinned stickies first and each group by its latest update', () => {
    let now = 1
    const store = new StickyStore(userData(), () => now++)
    const first = store.create({ body: 'first' })
    const pinnedOld = store.create({ body: 'pinned old', pinned: true, color: 'pink' })
    const latest = store.create({ body: 'latest', color: 'green' })
    const pinnedNew = store.create({ body: 'pinned new', pinned: true, color: 'purple' })

    expect(store.list().map(sticky => sticky.id)).toEqual([pinnedNew.id, pinnedOld.id, latest.id, first.id])
    store.update(first.id, { pinned: true })
    expect(store.list().map(sticky => sticky.id)).toEqual([first.id, pinnedNew.id, pinnedOld.id, latest.id])
  })

  it('keeps only valid fields and records when loading data', () => {
    const directory = userData()
    const file = path.join(directory, 'stickies.json')
    fs.writeFileSync(
      file,
      JSON.stringify([
        {
          id: '  kept  ',
          title: '  A note  ',
          body: '# hello',
          color: 'yellow',
          pinned: false,
          createdAt: 1,
          updatedAt: 2,
          extra: 'gone'
        },
        {
          id: 'kept',
          body: 'duplicate',
          color: 'blue',
          pinned: true,
          createdAt: 3,
          updatedAt: 4
        },
        { id: 'bad-color', body: '', color: 'orange', pinned: false, createdAt: 1, updatedAt: 1 },
        { id: 'bad-date', body: '', color: 'pink', pinned: false, createdAt: -1, updatedAt: 1 },
        null
      ])
    )

    expect(new StickyStore(directory).list()).toEqual([
      {
        id: 'kept',
        title: 'A note',
        body: '# hello',
        color: 'yellow',
        pinned: false,
        createdAt: 1,
        updatedAt: 2
      }
    ])
  })

  it('moves malformed data aside before a later write', () => {
    const directory = userData()
    const file = path.join(directory, 'stickies.json')
    fs.writeFileSync(file, '{ broken')
    const store = new StickyStore(directory, () => 5)

    expect(store.list()).toEqual([])
    expect(fs.existsSync(file)).toBe(false)
    expect(fs.readdirSync(directory).some(name => name.startsWith('stickies.json.corrupt-'))).toBe(true)
    store.create({ body: 'safe' })
    expect(store.list()).toHaveLength(1)
  })

  it('atomically replaces a private file without leaving temporary files', () => {
    const directory = userData()
    const store = new StickyStore(directory, () => 1)
    store.create({ body: 'one' })
    store.create({ body: 'two' })

    expect(fs.statSync(store.file).mode & 0o777).toBe(0o600)
    expect(fs.readdirSync(directory).filter(name => name.endsWith('.tmp'))).toEqual([])
    expect(JSON.parse(fs.readFileSync(store.file, 'utf8'))).toHaveLength(2)
  })

  it('rejects invalid mutation values without changing the file', () => {
    const directory = userData()
    const store = new StickyStore(directory, () => 1)
    const made = store.create({ body: 'safe' })
    const before = fs.readFileSync(store.file, 'utf8')

    expect(() => store.update(made.id, { color: 'orange' as never })).toThrow(TypeError)
    expect(() => store.create({ body: 2 as never })).toThrow(TypeError)
    expect(fs.readFileSync(store.file, 'utf8')).toBe(before)
  })
})
