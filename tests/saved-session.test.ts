import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SavedSessionStore } from '../src/main/saved-session'
import { tmpDir } from './helpers/session'

describe('saved session store', () => {
  it('round-trips the active session and keeps joined sessions after leaving', () => {
    const store = new SavedSessionStore(path.join(tmpDir('saved'), 'session.json'))
    expect(store.load()).toBeNull()
    expect(store.recentJoins()).toEqual([])

    store.save({ mode: 'host', folder: '/tmp/repo', name: 'sam', home: 'folder', shared: true })
    expect(store.load()).toEqual({
      mode: 'host',
      folder: '/tmp/repo',
      name: 'sam',
      home: 'folder',
      shared: true
    })
    expect(store.recentJoins()).toEqual([])

    store.save({ mode: 'join', folder: '/tmp/repo', name: 'jamel', link: 'crew://1.2.3.4:2739/abc123' })
    expect(store.load()).toEqual({
      mode: 'join',
      folder: '/tmp/repo',
      name: 'jamel',
      link: 'crew://1.2.3.4:2739/abc123'
    })
    expect(store.recentJoins()).toEqual([
      expect.objectContaining({
        folder: '/tmp/repo',
        name: 'jamel',
        link: 'crew://1.2.3.4:2739/abc123'
      })
    ])

    store.clear()
    expect(store.load()).toBeNull()
    expect(store.recentJoins()).toHaveLength(1)
    store.clear()
  })

  it('ignores files that do not describe a session', () => {
    const file = path.join(tmpDir('saved-bad'), 'session.json')
    fs.writeFileSync(file, 'not json')
    expect(new SavedSessionStore(file).load()).toBeNull()

    fs.writeFileSync(file, JSON.stringify({ mode: 'join', folder: '/tmp/repo', name: 'jamel' }))
    expect(new SavedSessionStore(file).load()).toBeNull()

    fs.writeFileSync(file, JSON.stringify({ mode: 'weird', folder: '/tmp/repo', name: 'jamel' }))
    expect(new SavedSessionStore(file).load()).toBeNull()
  })

  // Every row on the way in can be taken off it, a project and a crew somebody
  // invited you to alike, so a join is forgotten by its own link.
  it('forgets a joined session without touching the rest of the list', () => {
    const store = new SavedSessionStore(path.join(tmpDir('saved-forget-join'), 'session.json'))
    store.save({ mode: 'join', folder: '/tmp/one', name: 'jamel', link: 'crew://1.2.3.4:2739/one' })
    store.save({ mode: 'join', folder: '/tmp/two', name: 'jamel', link: 'crew://1.2.3.4:2739/two' })

    store.forgetJoin('crew://1.2.3.4:2739/one')

    expect(store.recentJoins().map(recent => recent.link)).toEqual(['crew://1.2.3.4:2739/two'])
    store.forgetJoin('crew://1.2.3.4:2739/nothing')
    expect(store.recentJoins()).toHaveLength(1)
  })

  it('deduplicates joined sessions by link and keeps the five newest', () => {
    const store = new SavedSessionStore(path.join(tmpDir('saved-recents'), 'session.json'))
    for (let index = 0; index < 6; index++) {
      store.save({
        mode: 'join',
        folder: `/tmp/repo-${index}`,
        name: 'jamel',
        link: `crew://1.2.3.4:2739/abc12${index}`
      })
    }
    store.save({
      mode: 'join',
      folder: '/tmp/moved',
      name: 'ali',
      link: 'crew://1.2.3.4:2739/abc123'
    })

    const recent = store.recentJoins()
    expect(recent).toHaveLength(5)
    expect(recent[0]).toEqual(expect.objectContaining({ folder: '/tmp/moved', name: 'ali' }))
    expect(recent.filter(item => item.link === 'crew://1.2.3.4:2739/abc123')).toHaveLength(1)
  })
})
