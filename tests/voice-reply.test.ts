import { describe, expect, it } from 'vitest'
import { lastBoundary, VoiceReply } from '../src/shared/voiceReply'

const fence = (body: unknown) => ['```card', JSON.stringify(body), '```'].join('\n')

describe('where it is safe to stop', () => {
  it('stops on a full stop and not before one', () => {
    expect(lastBoundary('Let me check the', 0)).toBe(0)
    expect(lastBoundary('It passed. Now the', 0)).toBe(11)
  })

  it('is not fooled by an abbreviation', () => {
    expect(lastBoundary('Try e.g. this one', 0)).toBe(0)
    expect(lastBoundary('Ask J. Smith about it', 0)).toBe(0)
  })

  it('takes a line ending as an ending', () => {
    expect(lastBoundary('a heading\nand more', 0)).toBe(10)
  })

  it('never goes back past where it was', () => {
    expect(lastBoundary('One. Two. Three', 10)).toBe(10)
  })
})

describe('saying a reply while it is still being written', () => {
  it('holds a part sentence back and says it once it lands', () => {
    const reply = new VoiceReply()
    expect(reply.grew('Let me look at')).toEqual({ say: '', cards: [] })
    expect(reply.grew('Let me look at that.').say).toBe('Let me look at that.')
    expect(reply.grew('Let me look at that.').say).toBe('')
  })

  it('says each sentence once and never twice', () => {
    const reply = new VoiceReply()
    const said: string[] = []
    for (const raw of ['One.', 'One. Two.', 'One. Two. Three.']) {
      const grew = reply.grew(raw)
      if (grew.say) said.push(grew.say)
    }
    expect(said.join(' ')).toBe('One. Two. Three.')
  })

  it('says nothing at all while a card is half written', () => {
    const reply = new VoiceReply()
    expect(reply.grew('Here it is.\n```card\n{"kind":"note",').say).toBe('Here it is.')
    expect(reply.grew('Here it is.\n```card\n{"kind":"note","text":"a"').say).toBe('')
    expect(reply.grew('Here it is.\n```card\n{"kind":"note","text":"a"}\n```\n').cards).toEqual([
      { kind: 'note', text: 'a' }
    ])
  })

  it('never says a line of the card itself', () => {
    const reply = new VoiceReply()
    const whole = ['Two failed.', fence({ kind: 'list', items: ['one', 'two'] }), 'Want the log?'].join('\n')
    const said: string[] = []
    for (let at = 1; at <= whole.length; at++) {
      const grew = reply.grew(whole.slice(0, at))
      if (grew.say) said.push(grew.say)
    }
    said.push(reply.whole(whole).say)
    const spoken = said.join(' ')
    expect(spoken).not.toContain('kind')
    expect(spoken).not.toContain('```')
    expect(spoken).toContain('Two failed.')
    expect(spoken).toContain('Want the log?')
  })

  it('draws a card the moment it is whole rather than at the end', () => {
    const reply = new VoiceReply()
    const upTo = ['Here.', fence({ kind: 'note', text: 'now' }), ''].join('\n')
    expect(reply.grew(upTo).cards).toEqual([{ kind: 'note', text: 'now' }])
  })

  it('gives up the rest when the reply is whole', () => {
    const reply = new VoiceReply()
    reply.grew('All done. And')
    expect(reply.whole('All done. And it worked').say).toBe('And it worked')
    expect(reply.whole('All done. And it worked').say).toBe('')
  })

  it('says everything exactly once over a whole run', () => {
    const reply = new VoiceReply()
    const whole = 'I read the file. It sets the flag twice.\nThe second one wins.'
    const said: string[] = []
    for (let at = 1; at <= whole.length; at++) {
      const grew = reply.grew(whole.slice(0, at))
      if (grew.say) said.push(grew.say)
    }
    const rest = reply.whole(whole)
    if (rest.say) said.push(rest.say)
    expect(said.join(' ').replace(/\s+/g, ' ')).toBe(whole.replace(/\s+/g, ' '))
  })

  it('says a reply that is nothing but a card as nothing', () => {
    const reply = new VoiceReply()
    const whole = fence({ kind: 'note', text: 'only' })
    reply.grew(whole)
    const rest = reply.whole(whole)
    expect(`${reply.grew(whole).say}${rest.say}`.trim()).toBe('')
  })
})
