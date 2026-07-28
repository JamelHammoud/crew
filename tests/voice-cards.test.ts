import { describe, expect, it } from 'vitest'
import {
  CARDS_LIMIT,
  cleanCard,
  OPTIONS_LIMIT,
  readCards,
  readReply,
  ROWS_LIMIT,
  spokenText,
  TITLE_LIMIT,
  VOICE_INSTRUCTIONS
} from '../src/shared/voice'

const fence = (body: unknown) => ['```card', JSON.stringify(body), '```'].join('\n')

describe('what a card may be', () => {
  it('keeps the five kinds', () => {
    expect(cleanCard({ kind: 'facts', rows: [{ label: 'Passed', value: '84' }] })).toEqual({
      kind: 'facts',
      rows: [{ label: 'Passed', value: '84' }]
    })
    expect(cleanCard({ kind: 'list', items: ['one', 'two'] })).toEqual({ kind: 'list', items: ['one', 'two'] })
    expect(cleanCard({ kind: 'choice', options: ['yes', 'no'] })).toEqual({ kind: 'choice', options: ['yes', 'no'] })
    expect(cleanCard({ kind: 'code', text: 'a()', language: 'TS' })).toEqual({
      kind: 'code',
      language: 'ts',
      text: 'a()'
    })
    expect(cleanCard({ kind: 'note', text: 'a line' })).toEqual({ kind: 'note', text: 'a line' })
  })

  it('is null rather than an empty box', () => {
    expect(cleanCard({ kind: 'facts', rows: [] })).toBeNull()
    expect(cleanCard({ kind: 'list', items: ['  ', ''] })).toBeNull()
    expect(cleanCard({ kind: 'choice' })).toBeNull()
    expect(cleanCard({ kind: 'code', text: '   ' })).toBeNull()
    expect(cleanCard({ kind: 'note', text: '' })).toBeNull()
    expect(cleanCard({ kind: 'weather', city: 'Beirut' })).toBeNull()
    expect(cleanCard(null)).toBeNull()
    expect(cleanCard('facts')).toBeNull()
  })

  it('holds a card to its own size', () => {
    const long = 'x'.repeat(400)
    const card = cleanCard({
      kind: 'facts',
      title: long,
      rows: Array.from({ length: 40 }, (_, i) => ({ label: `l${i}`, value: `v${i}` }))
    })
    expect(card?.kind).toBe('facts')
    if (card?.kind !== 'facts') throw new Error('expected facts')
    expect(card.title).toHaveLength(TITLE_LIMIT)
    expect(card.rows).toHaveLength(ROWS_LIMIT)
    const choice = cleanCard({ kind: 'choice', options: ['a', 'b', 'c', 'd', 'e', 'f'] })
    if (choice?.kind !== 'choice') throw new Error('expected choice')
    expect(choice.options).toHaveLength(OPTIONS_LIMIT)
  })

  it('leaves a title off rather than carrying an empty one', () => {
    expect(cleanCard({ kind: 'note', text: 'hi', title: '   ' })).toEqual({ kind: 'note', text: 'hi' })
  })
})

describe('reading cards out of a reply', () => {
  it('takes the card out of what gets said', () => {
    const reply = ['Two of them failed.', fence({ kind: 'list', items: ['one', 'two'] }), 'Want the log?'].join('\n')
    const { spoken, cards } = readCards(reply)
    expect(cards).toEqual([{ kind: 'list', items: ['one', 'two'] }])
    expect(spoken).not.toContain('```')
    expect(spoken).not.toContain('kind')
    expect(spoken).toContain('Two of them failed.')
    expect(spoken).toContain('Want the log?')
  })

  it('drops a fence that is not a card and says the rest', () => {
    const { spoken, cards } = readCards(['Here.', '```card', 'not json at all', '```'].join('\n'))
    expect(cards).toEqual([])
    expect(spoken.trim()).toBe('Here.')
  })

  it('never draws more than the limit', () => {
    const many = Array.from({ length: 6 }, (_, i) => fence({ kind: 'note', text: `n${i}` })).join('\n')
    const { spoken, cards } = readCards(many)
    expect(cards).toHaveLength(CARDS_LIMIT)
    expect(spoken.trim()).toBe('')
  })

  it('reads an indented fence', () => {
    const { cards } = readCards(['  ```card', '  {"kind":"note","text":"in"}', '  ```'].join('\n'))
    expect(cards).toEqual([{ kind: 'note', text: 'in' }])
  })
})

describe('what a voice can say', () => {
  it('never says a mark it cannot pronounce', () => {
    const said = spokenText('**Ready.** Run `yarn test` and see [the docs](https://x.dev/a) 🎉')
    expect(said).toBe('Ready. Run yarn test and see the docs')
  })

  it('drops a code block whole', () => {
    const said = spokenText(['Done.', '```ts', 'const a = 1', '```', 'That is it.'].join('\n'))
    expect(said).toBe('Done.\n\nThat is it.')
  })

  it('reads a list as sentences rather than as dashes', () => {
    expect(spokenText('- one\n- two\n- three')).toBe('one\ntwo\nthree')
  })

  it('keeps a numbered list numbered', () => {
    expect(spokenText('1. one\n2. two')).toBe('1. one\n2. two')
  })

  it('leaves a word with an underscore alone', () => {
    expect(spokenText('The read_file tool and snake_case names.')).toBe('The read_file tool and snake_case names.')
  })

  it('takes the at off a name', () => {
    expect(spokenText('Ask @Bubbles about it')).toBe('Ask Bubbles about it')
  })

  it('drops headings, quotes and rules', () => {
    expect(spokenText('## Result\n\n> it passed\n\n---\n\nGood.')).toBe('Result\n\nit passed\n\nGood.')
  })

  it('says a table row as words', () => {
    expect(spokenText('| Passed | 84 |')).toBe('Passed 84')
  })
})

describe('both halves at once', () => {
  it('gives the words to say and the thing to draw', () => {
    const { spoken, cards } = readReply(
      ['**84 passed, two failed.**', fence({ kind: 'facts', rows: [{ label: 'Failed', value: '2' }] })].join('\n')
    )
    expect(spoken).toBe('84 passed, two failed.')
    expect(cards).toEqual([{ kind: 'facts', rows: [{ label: 'Failed', value: '2' }] }])
  })

  it('leaves nothing to say when the whole reply was a card', () => {
    const { spoken, cards } = readReply(fence({ kind: 'note', text: 'only this' }))
    expect(spoken).toBe('')
    expect(cards).toHaveLength(1)
  })
})

describe('the brief', () => {
  it('shows the shape of a card the reader can really read', () => {
    const { cards } = readCards(VOICE_INSTRUCTIONS)
    expect(cards).toHaveLength(1)
    expect(cards[0].kind).toBe('facts')
  })

  it('is written the way the app writes', () => {
    expect(VOICE_INSTRUCTIONS).not.toMatch(/[—–]/)
  })
})
