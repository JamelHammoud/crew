import { describe, expect, it } from 'vitest'
import {
  CUSTOM_EMOJI_NAME_LIMIT,
  CUSTOM_EMOJI_SCAN,
  CUSTOM_EMOJI_TYPES,
  cleanCustomEmojiName,
  customEmojiExtension,
  customEmojiNameFromFile,
  customEmojiNameIn,
  customEmojiNameTaken,
  customEmojiRef,
  isCustomEmojiFile,
  isCustomEmojiRef,
  mimeForCustomEmoji,
  type CustomEmoji
} from '../src/shared/customEmoji'

const scan = (text: string) => [...text.matchAll(CUSTOM_EMOJI_SCAN)].map(match => match[1])

const held = (name: string): CustomEmoji => ({
  id: name,
  name,
  file: `${name}.png`,
  by: 'Jamel',
  ts: 1
})

describe('the name somebody types', () => {
  it('reads the name under whatever it was written as', () => {
    expect(cleanCustomEmojiName('SHIP')).toBe('ship')
    expect(cleanCustomEmojiName(':ship:')).toBe('ship')
    expect(cleanCustomEmojiName('  ship  ')).toBe('ship')
    expect(cleanCustomEmojiName('Party Parrot')).toBe('party_parrot')
    expect(cleanCustomEmojiName('party.parrot')).toBe('party_parrot')
    expect(cleanCustomEmojiName('party   parrot')).toBe('party_parrot')
  })

  it('drops what cannot be in a name and keeps what is left', () => {
    expect(cleanCustomEmojiName('ship it!')).toBe('ship_it')
    expect(cleanCustomEmojiName('ship🎉')).toBe('ship')
    expect(cleanCustomEmojiName('+1')).toBe('1')
    expect(cleanCustomEmojiName('-nope')).toBe('nope')
    expect(cleanCustomEmojiName('_ship_')).toBe('ship_')
  })

  it('refuses what has nothing left in it', () => {
    expect(cleanCustomEmojiName('')).toBeNull()
    expect(cleanCustomEmojiName('   ')).toBeNull()
    expect(cleanCustomEmojiName('---')).toBeNull()
    expect(cleanCustomEmojiName('🎉')).toBeNull()
    expect(cleanCustomEmojiName('::')).toBeNull()
    expect(cleanCustomEmojiName(null)).toBeNull()
    expect(cleanCustomEmojiName(42)).toBeNull()
  })

  it('cuts a long one at the limit rather than turning it away', () => {
    const long = 'a'.repeat(CUSTOM_EMOJI_NAME_LIMIT + 8)
    expect(cleanCustomEmojiName(long)).toBe('a'.repeat(CUSTOM_EMOJI_NAME_LIMIT))
    expect(cleanCustomEmojiName('a'.repeat(CUSTOM_EMOJI_NAME_LIMIT))).toHaveLength(CUSTOM_EMOJI_NAME_LIMIT)
  })
})

describe('the name a file arrives under', () => {
  it('takes the name off what somebody really drops in', () => {
    expect(customEmojiNameFromFile('Party Parrot.gif')).toBe('party_parrot')
    expect(customEmojiNameFromFile('party-parrot (2).png')).toBe('party-parrot')
    expect(customEmojiNameFromFile('SHIP.PNG')).toBe('ship')
  })

  it('comes back empty for a file whose name is nothing but an extension', () => {
    expect(customEmojiNameFromFile('.gif')).toBe('')
  })
})

describe('writing one and reading it back', () => {
  it('gives the name back off its own ref', () => {
    expect(customEmojiRef('party_parrot')).toBe(':party_parrot:')
    expect(customEmojiNameIn(customEmojiRef('party_parrot'))).toBe('party_parrot')
    expect(isCustomEmojiRef(customEmojiRef('party_parrot'))).toBe(true)
  })

  it('is the whole of a value or it is nothing', () => {
    expect(customEmojiNameIn(':a b:')).toBeNull()
    expect(customEmojiNameIn('::')).toBeNull()
    expect(customEmojiNameIn('parrot')).toBeNull()
    expect(customEmojiNameIn(' :parrot:')).toBeNull()
    expect(customEmojiNameIn(':parrot: ')).toBeNull()
    expect(customEmojiNameIn('x:parrot:')).toBeNull()
    expect(customEmojiNameIn(':parrot:y')).toBeNull()
    expect(customEmojiNameIn(':Parrot:')).toBeNull()
    expect(isCustomEmojiRef(':a b:')).toBe(false)
  })

  it('says a name is answering for something already', () => {
    const list = [held('parrot'), held('ship')]
    expect(customEmojiNameTaken(list, 'ship')).toBe(true)
    expect(customEmojiNameTaken(list, 'tada')).toBe(false)
  })
})

// This is the guard that keeps a name somebody typed off the disk, so what it
// accepts is exactly what the app wrote down itself and nothing else.
describe('what may be read off the disk', () => {
  const uuid = '3f2b1c8e-9a4d-4c7b-8e1f-2a5d6c7b8e9f'

  it('takes a name the app wrote, in each of the four kinds', () => {
    for (const extension of ['gif', 'png', 'webp', 'jpg']) {
      expect(isCustomEmojiFile(`${uuid}.${extension}`)).toBe(true)
    }
  })

  it('refuses anything that is a path rather than a name', () => {
    expect(isCustomEmojiFile(`emoji/${uuid}.png`)).toBe(false)
    expect(isCustomEmojiFile(`../${uuid}.png`)).toBe(false)
    expect(isCustomEmojiFile('..png')).toBe(false)
    expect(isCustomEmojiFile(`${uuid}..png`)).toBe(false)
    expect(isCustomEmojiFile(`/${uuid}.png`)).toBe(false)
    expect(isCustomEmojiFile(`a/b/${uuid}.png`)).toBe(false)
  })

  it('refuses an extension that is not one of the four', () => {
    expect(isCustomEmojiFile(`${uuid}.svg`)).toBe(false)
    expect(isCustomEmojiFile(`${uuid}.jpeg`)).toBe(false)
    expect(isCustomEmojiFile(`${uuid}.html`)).toBe(false)
    expect(isCustomEmojiFile(`${uuid}.png.svg`)).toBe(false)
    expect(isCustomEmojiFile(`${uuid}.PNG`)).toBe(false)
    expect(isCustomEmojiFile(uuid)).toBe(false)
    expect(isCustomEmojiFile('.png')).toBe(false)
    expect(isCustomEmojiFile('')).toBe(false)
    expect(isCustomEmojiFile(`${uuid}.png\n${uuid}.svg`)).toBe(false)
  })
})

describe('the type a file is served as', () => {
  it('agrees with the extension it is kept under, both ways round', () => {
    for (const [mime, extension] of Object.entries(CUSTOM_EMOJI_TYPES)) {
      expect(customEmojiExtension(mime)).toBe(extension)
      expect(customEmojiExtension(mimeForCustomEmoji(`x.${extension}`))).toBe(extension)
    }
  })

  it('names no type for a picture that is not one of them', () => {
    expect(customEmojiExtension('image/svg+xml')).toBeNull()
    expect(customEmojiExtension('text/html')).toBeNull()
    expect(customEmojiExtension('')).toBeNull()
    expect(mimeForCustomEmoji('x.svg')).toBe('application/octet-stream')
    expect(mimeForCustomEmoji('noextension')).toBe('application/octet-stream')
  })
})

describe('finding a name in prose', () => {
  it('finds every one in a sentence', () => {
    expect(scan('ship it :parrot: and :tada: now')).toEqual(['parrot', 'tada'])
    expect(scan(':parrot:')).toEqual(['parrot'])
  })

  it('finds none where there is no name to find', () => {
    expect(scan('a::b')).toEqual([])
    expect(scan(':')).toEqual([])
    expect(scan('a : b :')).toEqual([])
    expect(scan('12:30 and 4:05')).toEqual([])
    expect(scan(':Parrot:')).toEqual([])
  })
})
