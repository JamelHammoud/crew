// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { tokenizeEmoji } from '../Users/jamel/Documents/Repositories/crew/src/renderer/src/components/emojiTokens'
import { lookupEmoji } from '../Users/jamel/Documents/Repositories/crew/src/renderer/src/components/emojiData'

describe('dbg', () => {
  it('shows', () => {
    console.log(JSON.stringify([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment('👍🏽 🇱🇧')].map(s => s.segment)))
    console.log('thumb base', !!lookupEmoji('👍'), 'thumb tone', !!lookupEmoji('👍🏽'), 'flag', !!lookupEmoji('🇱🇧'))
    console.log(JSON.stringify(tokenizeEmoji('👍🏽 🇱🇧').map(t => t.kind)))
    expect(true).toBe(true)
  })
})
