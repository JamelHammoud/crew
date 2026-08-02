import { beforeEach, describe, expect, it } from 'vitest'
import { joinPlace, projectPlace } from '../src/shared/places'
import type { RecentJoin, RecentProject } from '../src/shared/recent'
import { installLocalStorage } from './helpers/local-storage'

const storage = installLocalStorage()

const { placesOf } = await import('../src/renderer/src/views/home/place')
const { PLACE_NAME_LIMIT, cleanPlaceName, keepName, savedNames } = await import(
  '../src/renderer/src/state/placeNames'
)

const FOLDER = '/Users/jamel/Documents/Repositories/crew'
const LINK = 'crew://192.0.2.10:2739/abc123'

const project: RecentProject = {
  folder: FOLDER,
  name: 'Jamel',
  home: 'folder',
  key: 'one',
  sync: true,
  shared: true,
  openedAt: 2
}

const join: RecentJoin = {
  folder: '/Users/jamel/work',
  name: 'Jamel',
  link: LINK,
  joinedAt: 1
}

const placeAt = (index: number, names: Record<string, string> = {}) =>
  placesOf([project], [join], names)[index]

describe('a place you have named yourself', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('stands in place of the address a crew was joined at', () => {
    expect(placeAt(1).title).toBe('192.0.2.10:2739')
    expect(placeAt(1, { [joinPlace(LINK)]: "Ali's Mac" }).title).toBe("Ali's Mac")
  })

  it('says the address underneath, so nothing about where it really is is lost', () => {
    expect(placeAt(1).line).toBe('work')
    expect(placeAt(1, { [joinPlace(LINK)]: "Ali's Mac" }).line).toBe('192.0.2.10:2739')
  })

  it('stands in place of a project folder and says the whole path underneath', () => {
    expect(placeAt(0).title).toBe('crew')
    expect(placeAt(0).line).toBe('~/Documents/Repositories')
    const named = placeAt(0, { [projectPlace(FOLDER)]: 'Wallet' })
    expect(named.title).toBe('Wallet')
    expect(named.line).toBe('~/Documents/Repositories/crew')
  })

  it('keeps what the place is really called, for the card that renames it', () => {
    const named = placeAt(0, { [projectPlace(FOLDER)]: 'Wallet' })
    expect(named.given).toBe('crew')
    expect(named.nickname).toBe('Wallet')
    expect(placeAt(0).nickname).toBe(null)
  })

  it('is never a name with nothing in it', () => {
    expect(cleanPlaceName('  ')).toBe('')
    expect(cleanPlaceName('  Ali   the   second ')).toBe('Ali the second')
    expect(cleanPlaceName('x'.repeat(200))).toHaveLength(PLACE_NAME_LIMIT)
  })

  it('is written down where it was typed, and taken off by a name blanked', () => {
    keepName(projectPlace(FOLDER), ' Wallet ')
    expect(savedNames()).toEqual({ [projectPlace(FOLDER)]: 'Wallet' })
    expect(placeAt(0, savedNames()).title).toBe('Wallet')

    keepName(projectPlace(FOLDER), '   ')
    expect(savedNames()).toEqual({})
    expect(placeAt(0, savedNames()).title).toBe('crew')
  })

  it('reads nothing out of a store that holds junk', () => {
    storage.setItem('crew.place-names', '{')
    expect(savedNames()).toEqual({})
    storage.setItem('crew.place-names', '["Wallet"]')
    expect(savedNames()).toEqual({})
    storage.setItem('crew.place-names', JSON.stringify({ [projectPlace(FOLDER)]: 7 }))
    expect(savedNames()).toEqual({})
  })
})
