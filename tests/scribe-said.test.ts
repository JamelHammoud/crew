import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ScribeHistory } from '../src/main/scribe-said'
import { SAID_LIMIT, cleanSaid, type Said } from '../src/shared/scribeSaid'

// The last few dictations, against a real file. Nothing here goes near electron:
// the history is handed the path it writes to, the way the pill's spot is, which
// is the whole of what lets a folder in the temp directory stand in for the one
// the app keeps beside itself.

let dir = ''
let file = ''

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crew-scribe-said-'))
  file = path.join(dir, 'said.json')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const opened = (): ScribeHistory => {
  const said = new ScribeHistory()
  said.remember(file)
  return said
}

// One dictation, in as many stretches as it was written in.
const spoke = (said: ScribeHistory, ...stretches: string[]): boolean => {
  said.begin()
  for (const stretch of stretches) said.add(stretch)
  return said.seal()
}

const row = (over: Partial<Said> = {}): Record<string, unknown> => ({
  id: 'a',
  text: 'We shipped it.',
  at: 1000,
  ...over
})

describe('a take is one entry however many stretches it was written in', () => {
  it('joins them in the order they were spoken', () => {
    const said = opened()
    expect(spoke(said, 'The runner reads the prompt.', ' It hands it to the CLI.')).toBe(true)
    expect(said.all()).toHaveLength(1)
    expect(said.all()[0].text).toBe('The runner reads the prompt. It hands it to the CLI.')
  })

  // The stretch carries the space that keeps it off the end of the one before
  // it, so anything added here would land as a second one.
  it('puts nothing between them', () => {
    const said = opened()
    spoke(said, 'we read the file', ' and it was empty')
    expect(said.all()[0].text).toBe('we read the file and it was empty')
  })

  it('trims the whole of what was said', () => {
    const said = opened()
    spoke(said, '  the build is green  ')
    expect(said.all()[0].text).toBe('the build is green')
  })

  it('stamps it with an id and a time', () => {
    const said = opened()
    const before = Date.now()
    spoke(said, 'the tests pass')
    const entry = said.all()[0]
    expect(entry.id).not.toBe('')
    expect(entry.at).toBeGreaterThanOrEqual(before)
    expect(entry.at).toBeLessThanOrEqual(Date.now())
  })

  it('gives every one of them an id of its own', () => {
    const said = opened()
    spoke(said, 'first')
    spoke(said, 'second')
    expect(said.all()[0].id).not.toBe(said.all()[1].id)
  })
})

describe('a take nobody said anything into', () => {
  it('leaves no entry', () => {
    const said = opened()
    said.begin()
    expect(said.seal()).toBe(false)
    expect(said.all()).toEqual([])
  })

  it('leaves no entry for one that is only whitespace', () => {
    const said = opened()
    expect(spoke(said, '   ', '\n')).toBe(false)
    expect(said.all()).toEqual([])
  })

  it('leaves no entry for one that was never begun', () => {
    const said = opened()
    said.add('the panel is fine')
    expect(said.seal()).toBe(false)
    expect(said.all()).toEqual([])
  })

  it('writes no file for one that was never begun', () => {
    const said = opened()
    said.seal()
    expect(fs.existsSync(file)).toBe(false)
  })

  it('does nothing on a second seal', () => {
    const said = opened()
    expect(spoke(said, 'we shipped it')).toBe(true)
    expect(said.seal()).toBe(false)
    expect(said.all()).toHaveLength(1)
  })
})

describe('opening a take again', () => {
  it('throws away what the last unsealed one held', () => {
    const said = opened()
    said.begin()
    said.add('the reader is next')
    said.begin()
    said.add('the writer is next')
    expect(said.seal()).toBe(true)
    expect(said.all()).toHaveLength(1)
    expect(said.all()[0].text).toBe('the writer is next')
  })
})

describe('the page holds the last of them and no more', () => {
  it('keeps the newest and drops the oldest', () => {
    const said = opened()
    for (let i = 0; i < SAID_LIMIT + 5; i++) spoke(said, `dictation ${i}`)
    const page = said.all()
    expect(page).toHaveLength(SAID_LIMIT)
    expect(page[0].text).toBe(`dictation ${SAID_LIMIT + 4}`)
    expect(page[page.length - 1].text).toBe('dictation 5')
    expect(page.map(entry => entry.text)).not.toContain('dictation 0')
  })
})

describe('taking one back off the page', () => {
  it('takes out the one named and leaves the rest', () => {
    const said = opened()
    spoke(said, 'first')
    spoke(said, 'second')
    spoke(said, 'third')
    said.forget(said.all()[1].id)
    expect(said.all().map(entry => entry.text)).toEqual(['third', 'first'])
  })

  it('takes the lot when nothing is named', () => {
    const said = opened()
    spoke(said, 'first')
    spoke(said, 'second')
    said.forget()
    expect(said.all()).toEqual([])
  })

  it('leaves the page alone for an id that is not on it', () => {
    const said = opened()
    spoke(said, 'first')
    said.forget('an id nothing answers to')
    expect(said.all()).toHaveLength(1)
  })

  it('is safe when there is nothing there', () => {
    const said = opened()
    expect(() => said.forget('anything')).not.toThrow()
    expect(() => said.forget()).not.toThrow()
    expect(said.all()).toEqual([])
  })

  it('stays gone the next time the file is read', () => {
    const said = opened()
    spoke(said, 'first')
    spoke(said, 'second')
    said.forget(said.all()[0].id)
    expect(
      opened()
        .all()
        .map(entry => entry.text)
    ).toEqual(['first'])
  })
})

describe('reading the file back', () => {
  it('finds what the last one wrote, newest first', () => {
    const said = opened()
    spoke(said, 'the schema is done')
    spoke(said, 'the reader is next')
    expect(
      opened()
        .all()
        .map(entry => entry.text)
    ).toEqual(['the reader is next', 'the schema is done'])
  })

  it('keeps the ids it was written with', () => {
    const said = opened()
    spoke(said, 'we shipped it')
    expect(opened().all()[0].id).toBe(said.all()[0].id)
  })

  it('is an empty page when there is no file at all', () => {
    expect(opened().all()).toEqual([])
  })

  it('carries on writing after a page it read back', () => {
    spoke(opened(), 'the schema is done')
    const said = opened()
    spoke(said, 'the reader is next')
    expect(
      opened()
        .all()
        .map(entry => entry.text)
    ).toEqual(['the reader is next', 'the schema is done'])
  })
})

describe('a file holding something else', () => {
  const held = (contents: string): ScribeHistory => {
    fs.writeFileSync(file, contents)
    return opened()
  }

  it('is an empty page for something that is not JSON', () => {
    expect(held('the reader is next').all()).toEqual([])
  })

  it('is an empty page for an object', () => {
    expect(held(JSON.stringify({ said: [row()] })).all()).toEqual([])
  })

  it('keeps the good rows out of an array holding bad ones', () => {
    const contents = JSON.stringify([row({ id: 'a' }), null, 'first', { id: 'b' }, row({ id: 'c' })])
    expect(
      held(contents)
        .all()
        .map(entry => entry.id)
    ).toEqual(['a', 'c'])
  })

  it('writes the clean page back over the junk', () => {
    const said = held(JSON.stringify([row({ id: 'a' }), 42]))
    spoke(said, 'the writer is next')
    expect(cleanSaid(JSON.parse(fs.readFileSync(file, 'utf8')))).toHaveLength(2)
  })
})

describe('what a row has to carry', () => {
  it('takes one that carries all three', () => {
    expect(cleanSaid([row()])).toEqual([{ id: 'a', text: 'We shipped it.', at: 1000 }])
  })

  it('trims the text it keeps', () => {
    expect(cleanSaid([row({ text: '  we shipped it  ' })])[0].text).toBe('we shipped it')
  })

  it('drops one with no id', () => {
    expect(cleanSaid([row({ id: '' }), row({ id: '   ' }), row({ id: undefined })])).toEqual([])
    expect(cleanSaid([{ ...row(), id: 7 }])).toEqual([])
  })

  it('drops one with nothing said in it', () => {
    expect(cleanSaid([row({ text: '' }), row({ text: '  ' }), row({ text: undefined })])).toEqual([])
    expect(cleanSaid([{ ...row(), text: 7 }])).toEqual([])
  })

  it('drops one with no time on it', () => {
    expect(cleanSaid([row({ at: undefined }), row({ at: Number.NaN })])).toEqual([])
    expect(
      cleanSaid([
        { ...row(), at: Number.POSITIVE_INFINITY },
        { ...row(), at: 'today' }
      ])
    ).toEqual([])
  })

  it('drops one that is not a row at all', () => {
    expect(cleanSaid([null, undefined, 'we shipped it', 7, []])).toEqual([])
  })

  it('is an empty page for anything that is not a list', () => {
    expect(cleanSaid(null)).toEqual([])
    expect(cleanSaid(undefined)).toEqual([])
    expect(cleanSaid('we shipped it')).toEqual([])
    expect(cleanSaid({ 0: row() })).toEqual([])
  })

  // The id is the whole of how a row is copied or taken away, so one that names
  // two rows names neither.
  it('keeps one of a pair sharing an id', () => {
    expect(cleanSaid([row({ id: 'a', text: 'first' }), row({ id: 'a', text: 'second' })])).toHaveLength(1)
  })

  it('hands them back newest first whatever order they were in', () => {
    const page = cleanSaid([row({ id: 'a', at: 1 }), row({ id: 'b', at: 3 }), row({ id: 'c', at: 2 })])
    expect(page.map(entry => entry.id)).toEqual(['b', 'c', 'a'])
  })

  it('holds the page to its limit', () => {
    const many = Array.from({ length: SAID_LIMIT + 10 }, (_, i) => row({ id: `id-${i}`, at: i }))
    const page = cleanSaid(many)
    expect(page).toHaveLength(SAID_LIMIT)
    expect(page[0].id).toBe(`id-${SAID_LIMIT + 9}`)
    expect(page[page.length - 1].id).toBe('id-10')
  })
})
