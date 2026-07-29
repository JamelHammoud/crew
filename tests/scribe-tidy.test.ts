import { describe, expect, it } from 'vitest'
import { ScribeChunk, TIDY_RULES, tidy } from '../src/shared/scribeTidy'

const WORD = 0.3
const BEAT = 0.05

const heard = (line: string): ScribeChunk[] => {
  const chunks: ScribeChunk[] = []
  let clock = 0
  let gap = 0
  for (const token of line.split(/\s+/)) {
    if (!token) continue
    const pause = /^\[([0-9.]+)\]$/.exec(token)
    if (pause) {
      gap = Number(pause[1])
      continue
    }
    clock += gap
    chunks.push({ text: token, start: clock, end: clock + WORD })
    clock += WORD
    gap = BEAT
  }
  return chunks
}

const written = (line: string, rules = TIDY_RULES): string => tidy(heard(line), rules)

describe('what whisper heard becomes what somebody meant to write', () => {
  const table: Array<[string, string, string]> = [
    ['drops the sounds nobody meant to make', 'um we should ship uh the fix', 'We should ship the fix.'],
    ['drops a sound at the end of a thought', 'that is done hmm', 'That is done.'],
    ['drops like where it stands as an aside', 'it was, like, huge', 'It was huge.'],
    ['drops you know where it stands as an aside', 'the tests pass, you know, most of them', 'The tests pass most of them.'],
    ['keeps I mean where it is really meant', 'I mean it', 'I mean it.'],
    ['keeps sort of where it is really meant', 'sort of blue', 'Sort of blue.'],
    ['keeps like inside real use', 'it looked like a wave', 'It looked like a wave.'],
    ['keeps right where it is a direction', 'turn right at the end', 'Turn right at the end.'],
    ['collapses a doubled word', 'the the file is open', 'The file is open.'],
    ['collapses a doubled I', 'I I think so', 'I think so.'],
    ['collapses a false start', 'I want, I want to ship it', 'I want to ship it.'],
    ['collapses a longer false start', 'we should we should go', 'We should go.'],
    ['keeps a real repetition', 'very very good', 'Very very good.'],
    ['keeps a real doubled had', 'the file had had a header', 'The file had had a header.'],
    ['cuts back to the start of the sentence', "let's use redis, scratch that, let's use postgres", "Let's use postgres."],
    ['takes the sentence before it when the correction opens one', "we'll use redis. [0.8] actually no, postgres", 'Postgres.'],
    ['takes the whole dictation with it', 'first the schema, scratch all that, we ship the reader', 'We ship the reader.'],
    ['starts over takes everything before it', 'open the panel, start over, open the doc', 'Open the doc.'],
    ['keeps forget that inside real use', "don't forget that the build is slow", "Don't forget that the build is slow."],
    ['closes a sentence on a long gap', 'we shipped it [0.9] the build is green', 'We shipped it. The build is green.'],
    ['takes a comma on a shorter gap', 'the tests are green [0.4] so I pushed it', 'The tests are green, so I pushed it.'],
    ['leaves one or two words without a comma', 'no [0.4] it works', 'No it works.'],
    ['never doubles a mark whisper already wrote', 'it works. [0.9] now the docs', 'It works. Now the docs.'],
    ['never ends on a comma', 'we are done [0.4] and that is it [0.4]', 'We are done, and that is it.'],
    ['keeps a question mark at the end', 'can you read the file?', 'Can you read the file?'],
    ['reads a spoken mark as an ordinary word', 'the period after the war', 'The period after the war.'],
    ['reads new line as ordinary words', 'put a new line after the comma here', 'Put a new line after the comma here.'],
    ['capitalizes a standalone i', 'i read it and i pushed', 'I read it and I pushed.'],
    ['capitalizes a contracted i', "i'm on it and i'll say when", "I'm on it and I'll say when."],
    ['gives an empty dictation nothing', '', ''],
    ['gives a dictation of nothing but sounds nothing', 'um uh hmm', '']
  ]

  for (const [name, spoken, meant] of table) it(name, () => expect(written(spoken)).toBe(meant))
})

describe('the gaps between the words', () => {
  it('holds a gap of nine tenths to a full stop and four tenths to a comma', () => {
    const spoken = 'I read the runner [0.4] it takes the prompt [0.9] the host writes it down'
    expect(written(spoken)).toBe('I read the runner, it takes the prompt. The host writes it down.')
  })

  it('leaves a chunk of several words alone inside itself', () => {
    const chunks: ScribeChunk[] = [
      { text: 'we read the file', start: 0, end: 1.2 },
      { text: 'and it was empty', start: 2.2, end: 3.4 }
    ]
    expect(tidy(chunks)).toBe('We read the file. And it was empty.')
  })

  it('reads a chunk with nothing on its clock without inventing a break', () => {
    const chunks: ScribeChunk[] = [
      { text: 'we shipped it', start: 0, end: 0 },
      { text: 'the build is green', start: 0, end: 0 }
    ]
    expect(tidy(chunks)).toBe('We shipped it the build is green.')
  })

  it('carries on past a timestamp that never arrived', () => {
    const chunks: ScribeChunk[] = [
      { text: 'the runner', start: 0, end: null as unknown as number },
      { text: 'takes it', start: 0.4, end: 0.9 },
      { text: 'from there', start: 1.9, end: 2.4 }
    ]
    expect(tidy(chunks)).toBe('The runner takes it. From there.')
  })

  it('gives a long run somewhere to breathe', () => {
    const run = [
      'the runner reads the prompt and hands it to the CLI on this machine which streams',
      '[0.3]',
      'every step back to the host so the crew can watch the work land in the thread as it happens'
    ].join(' ')
    const meant = [
      'The runner reads the prompt and hands it to the CLI on this machine which streams,',
      'every step back to the host so the crew can watch the work land in the thread as it happens.'
    ].join(' ')
    expect(written(run)).toBe(meant)
  })
})

describe('a correction that opens a sentence takes the one before it', () => {
  it('takes the sentence whisper had already closed', () => {
    const chunks: ScribeChunk[] = [
      { text: "Let's use redis.", start: 0, end: 1.5 },
      { text: 'Scratch that.', start: 2.4, end: 3.0 },
      { text: "Let's use postgres.", start: 3.4, end: 4.6 }
    ]
    expect(tidy(chunks)).toBe("Let's use postgres.")
  })

  it('still cuts back to the start of a sentence it stands inside', () => {
    const chunks: ScribeChunk[] = [
      { text: "let's use redis,", start: 0, end: 1.5 },
      { text: 'scratch that,', start: 1.6, end: 2.0 },
      { text: "let's use postgres", start: 2.1, end: 3.2 }
    ]
    expect(tidy(chunks)).toBe("Let's use postgres.")
  })

  it('reads actually wait as the same retraction', () => {
    const chunks: ScribeChunk[] = [
      { text: 'I think we should ship it today.', start: 0, end: 2.0 },
      { text: 'Actually, wait.', start: 2.6, end: 3.2 },
      { text: 'I think we should ship it tomorrow.', start: 3.6, end: 5.6 }
    ]
    expect(tidy(chunks)).toBe('I think we should ship it tomorrow.')
  })

  it('reaches back one sentence and never two', () => {
    const spoken = 'the schema is done. the reader is next. scratch that. the writer is next.'
    expect(written(spoken)).toBe('The schema is done. The writer is next.')
  })

  it('takes another sentence for a second correction straight after', () => {
    const spoken = 'the schema is done. the reader is next. scratch that. scratch that. the writer is next.'
    expect(written(spoken)).toBe('The writer is next.')
  })

  it('drops itself when there is nothing at all in front of it', () => {
    expect(written('scratch that. the panel is fine.')).toBe('The panel is fine.')
  })

  it('gives a dictation of nothing but a correction nothing', () => {
    expect(written('scratch that.')).toBe('')
  })

  it('still takes the whole dictation for scratch all that', () => {
    const spoken = 'the schema is done. the reader is next. scratch all that. we ship the writer.'
    expect(written(spoken)).toBe('We ship the writer.')
  })

  it('takes the whole dictation for scratch all of that', () => {
    const spoken = 'first the schema, then the reader, scratch all of that, we ship the writer'
    expect(written(spoken)).toBe('We ship the writer.')
  })
})

describe('the other ways somebody says they meant something else', () => {
  const table: Array<[string, string, string]> = [
    ['reads actually hold on at a boundary', "we ship it today. actually hold on. we ship it tomorrow.", 'We ship it tomorrow.'],
    ['reads sorry no at a boundary', 'use redis, sorry no, use postgres', 'Use postgres.'],
    ['reads no sorry at a boundary', 'use redis, no sorry, use postgres', 'Use postgres.'],
    // A bare hold on is somebody asking for a moment, not taking back what they
    // just said, and it is common enough at the head of a sentence that reading
    // it as a retraction would quietly eat a line nobody could see go.
    [
      'leaves a bare hold on alone, wherever it stands',
      'the branch is ready. hold on. the branch is not ready.',
      'The branch is ready. Hold on. The branch is not ready.'
    ],
    ['keeps hold on where it opens a real sentence', 'hold on to the branch', 'Hold on to the branch.'],
    ['keeps hold on inside a sentence', 'we should hold on until Friday', 'We should hold on until Friday.'],
    ['keeps wait where the sentence carries on', 'actually wait for the build to go green', 'Actually wait for the build to go green.']
  ]

  for (const [name, spoken, meant] of table) it(name, () => expect(written(spoken)).toBe(meant))
})

describe('the words a crew spells its own way', () => {
  const words = [{ from: 'claude', to: 'Claude' }]

  it('lands on the standalone word', () => {
    expect(written('ask claude about it', { ...TIDY_RULES, words })).toBe('Ask Claude about it.')
  })

  it('does not land inside a longer word', () => {
    expect(written('claudette read it', { ...TIDY_RULES, words })).toBe('Claudette read it.')
  })

  it('keeps the mark the word was wearing', () => {
    expect(written('that was claude, and it worked', { ...TIDY_RULES, words })).toBe('That was Claude, and it worked.')
  })

  it('takes whatever casing the replacement carries', () => {
    const swap = [{ from: 'postgres', to: 'PostgreSQL' }]
    expect(written('postgres is fine', { ...TIDY_RULES, words: swap })).toBe('PostgreSQL is fine.')
  })

  it('takes a phrase of more than one word', () => {
    const swap = [{ from: 'pull request', to: 'PR' }]
    expect(written('open a pull request for it', { ...TIDY_RULES, words: swap })).toBe('Open a PR for it.')
  })
})

describe('a rule switched off leaves its input alone', () => {
  it('keeps the fillers', () => {
    expect(written('um it was, like, huge', { ...TIDY_RULES, fillers: false })).toBe('Um it was, like, huge.')
  })

  it('keeps the stutter', () => {
    expect(written('the the file is open', { ...TIDY_RULES, stutters: false })).toBe('The the file is open.')
  })

  it('keeps the correction', () => {
    expect(written("let's use redis, scratch that, postgres", { ...TIDY_RULES, corrections: false })).toBe(
      "Let's use redis, scratch that, postgres."
    )
  })

  it('adds no mark of its own', () => {
    expect(written('we shipped it [0.9] the build is green', { ...TIDY_RULES, marks: false })).toBe(
      'We shipped it the build is green'
    )
  })

  it('leaves the marks whisper wrote where they are', () => {
    expect(written('it works. now the docs', { ...TIDY_RULES, marks: false })).toBe('It works. Now the docs')
  })
})

describe('a whole dictation, said the way people say them', () => {
  it('reads back as writing', () => {
    const spoken = [
      'um so I I think the runner should read the file first',
      '[0.9]',
      "then it, like, hands the whole thing to the CLI [0.4] and we wait for it to say something back"
    ].join(' ')
    const meant = [
      'So I think the runner should read the file first.',
      'Then it hands the whole thing to the CLI, and we wait for it to say something back.'
    ].join(' ')
    expect(written(spoken)).toBe(meant)
  })

  it('reads back a run somebody talked themselves out of', () => {
    const spoken = [
      "let's put the toolbox in the top bar, scratch that, it belongs under it",
      '[0.9]',
      'uh the panel can hold the tiles and the builder'
    ].join(' ')
    const meant = ['It belongs under it.', 'The panel can hold the tiles and the builder.'].join(' ')
    expect(written(spoken)).toBe(meant)
  })

  it('reads back a message somebody spoke into the chat box', () => {
    const spoken = [
      'hey [0.4] i pushed the fix for the sync loop',
      '[0.9]',
      'it, you know, commits everything first so nothing is sitting uncommitted [0.4] and then it pulls',
      '[0.9]',
      'can you have a look at the the git file when you get a minute?'
    ].join(' ')
    const meant = [
      'Hey I pushed the fix for the sync loop.',
      'It commits everything first so nothing is sitting uncommitted, and then it pulls.',
      'Can you have a look at the git file when you get a minute?'
    ].join(' ')
    expect(written(spoken)).toBe(meant)
  })

  it('leaves the sentences either side of a correction where they are', () => {
    const spoken = [
      'the runner reads the prompt.',
      '[0.9]',
      'it hands the whole thing to the host.',
      '[0.9]',
      'scratch that.',
      '[0.9]',
      'it hands the whole thing to the CLI.',
      '[0.9]',
      'the host only watches.'
    ].join(' ')
    const meant = [
      'The runner reads the prompt.',
      'It hands the whole thing to the CLI.',
      'The host only watches.'
    ].join(' ')
    expect(written(spoken)).toBe(meant)
  })

  it('reads back a correction the pauses alone marked off', () => {
    const spoken = [
      'um so the panel holds the tiles',
      '[0.9]',
      'the the builder sits at the end of the crew row',
      '[0.9]',
      'actually hold on',
      '[0.9]',
      'the builder sits in the empty slot',
      '[0.9]',
      'and that is the way in'
    ].join(' ')
    const meant = [
      'So the panel holds the tiles.',
      'The builder sits in the empty slot.',
      'And that is the way in.'
    ].join(' ')
    expect(written(spoken)).toBe(meant)
  })

  it('reads back a correction somebody made mid sentence', () => {
    const spoken = [
      'the host holds the call in memory [0.9] it writes the record to the log, no wait, it writes it to the session',
      '[0.9]',
      'either way nothing about the media is committed'
    ].join(' ')
    const meant = [
      'The host holds the call in memory.',
      'It writes it to the session.',
      'Either way nothing about the media is committed.'
    ].join(' ')
    expect(written(spoken)).toBe(meant)
  })
})
