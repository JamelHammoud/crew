import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SavedSessionStore } from '../src/main/saved-session'
import { tmpDir } from './helpers/session'

describe('saved session store', () => {
  it('round-trips host and join sessions and clears them', () => {
    const store = new SavedSessionStore(path.join(tmpDir('saved'), 'session.json'))
    expect(store.load()).toBeNull()

    store.save({ mode: 'host', folder: '/tmp/repo', name: 'sam' })
    expect(store.load()).toEqual({ mode: 'host', folder: '/tmp/repo', name: 'sam' })

    store.save({ mode: 'join', folder: '/tmp/repo', name: 'jamel', link: 'crew://1.2.3.4:2739/abc123' })
    expect(store.load()).toEqual({
      mode: 'join',
      folder: '/tmp/repo',
      name: 'jamel',
      link: 'crew://1.2.3.4:2739/abc123'
    })

    store.clear()
    expect(store.load()).toBeNull()
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
})
