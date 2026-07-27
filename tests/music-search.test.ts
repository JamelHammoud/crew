import { describe, expect, it } from 'vitest'
import {
  findMusic,
  findPlaylists,
  isMine,
  musicItems,
  type MusicPlaylist,
  type MusicUpload
} from '../src/shared/music'

// What the search bar in the music panel does. A row says three things about
// itself, the name, the word for what it is like, and whoever it came from, and
// what was typed is matched against all three.

const upload: MusicUpload = {
  id: 'u1',
  name: 'Bonnie Tyler',
  file: 'u1.mp3',
  seconds: 170,
  by: 'Jamel',
  ts: 0
}

const shelf = () => musicItems([upload])

const names = (query: string): string[] => findMusic(shelf(), query).map(item => item.name)

const lists: MusicPlaylist[] = [
  { id: 'l1', name: 'Late Night', by: 'Ali', trackIds: ['night-bus'], ts: 0 },
  { id: 'l2', name: 'Heads Down', by: 'Jamel', trackIds: [], ts: 0 }
]

describe('searching the music', () => {
  it('finds a track by its name, however it was typed', () => {
    expect(names('night bus')).toEqual(['Night Bus'])
    expect(names('NIGHT')).toEqual(['Night Bus'])
    expect(names('  bus  ')).toEqual(['Night Bus'])
  })

  it('finds a track by what it is like and by who it came from', () => {
    // The word a tune wears is part of the row, so it is part of the search.
    expect(names('fierce')).toEqual(['Boss Fight'])
    // A track somebody added says who added it, and that is searchable too.
    expect(names('jamel')).toEqual(['Bonnie Tyler'])
    expect(names('yours')).toEqual(['Bonnie Tyler'])
  })

  it('narrows on a second word rather than widening', () => {
    expect(names('night')).toEqual(['Night Bus'])
    expect(names('bus mellow')).toEqual(['Night Bus'])
    // Both words have to land somewhere on the same row, so a word that lands
    // on nothing takes the row out rather than bringing others in.
    expect(names('night fierce')).toEqual([])
  })

  it('hands back the whole shelf for nothing typed, and nothing for what it cannot find', () => {
    expect(findMusic(shelf(), '')).toHaveLength(shelf().length)
    expect(findMusic(shelf(), '   ')).toHaveLength(shelf().length)
    expect(names('polka')).toEqual([])
  })

  it('finds a playlist by its name and by whose it is', () => {
    expect(findPlaylists(lists, 'late').map(one => one.name)).toEqual(['Late Night'])
    expect(findPlaylists(lists, 'ali').map(one => one.name)).toEqual(['Late Night'])
    expect(findPlaylists(lists, 'jamel').map(one => one.name)).toEqual(['Heads Down'])
    expect(findPlaylists(lists, '')).toHaveLength(2)
    expect(findPlaylists(lists, 'nothing here')).toEqual([])
  })

  // Whose list it is decides who is shown the controls that change it, and the
  // host asks the same question of the same two strings.
  it('knows whose list it is by name, however it is capitalised', () => {
    expect(isMine(lists[0], 'Ali')).toBe(true)
    expect(isMine(lists[0], '  ali ')).toBe(true)
    expect(isMine(lists[0], 'Jamel')).toBe(false)
  })
})
