// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MessageReactions from '../src/renderer/src/components/MessageReactions'
import { reactionName } from '../src/renderer/src/components/ReactionTip'
import {
  addQuickReaction,
  quickReactions,
  removeQuickReaction,
  replaceQuickReaction,
  setQuickReactions
} from '../src/renderer/src/state/quickReactions'
import { useCrew } from '../src/renderer/src/state/store'
import { cleanQuickReactions, MAX_QUICK_REACTIONS, QUICK_REACTIONS } from '../src/shared/reactions'
import { installLocalStorage } from './helpers/local-storage'

const storage = installLocalStorage()
const defaultReactToMessage = useCrew.getState().reactToMessage

const KEY = 'crew.reactions.quick'
const TEN = ['🎉', '❤️', '👍', '😂', '🔥', '👀', '🙏', '🚀', '💯', '😅']

const mount = (reactToMessage = vi.fn()) => {
  useCrew.setState({ reactToMessage })
  render(
    createElement(
      'div',
      { className: 'group/message' },
      createElement(MessageReactions, {
        targetId: 'message:m1',
        reactions: [],
        deletable: false,
        onDelete: () => {}
      })
    )
  )
  return reactToMessage
}

const tray = () => screen.getByLabelText('More reactions').closest('div') as HTMLElement
const row = () =>
  [...tray().querySelectorAll('button[aria-label^="React with"]')].map(
    button => button.getAttribute('aria-label') as string
  )
const divider = () => tray().querySelector('span.w-px')

beforeEach(() => storage.clear())

afterEach(() => {
  cleanup()
  storage.clear()
  useCrew.setState({ reactToMessage: defaultReactToMessage })
})

describe('what a stored row really is', () => {
  it('hands back the four it ships with when there is nothing to read', () => {
    expect(cleanQuickReactions(null)).toEqual([...QUICK_REACTIONS])
    expect(cleanQuickReactions(undefined)).toEqual([...QUICK_REACTIONS])
    expect(cleanQuickReactions('👍')).toEqual([...QUICK_REACTIONS])
    expect(cleanQuickReactions({ 0: '👍' })).toEqual([...QUICK_REACTIONS])
  })

  it('draws one emoji once however many times it was written down', () => {
    expect(cleanQuickReactions(['👍', '👍', '🔥'])).toEqual(['👍', '🔥'])
  })

  it('drops what cannot stand on a row and keeps the rest', () => {
    expect(cleanQuickReactions(['👍', 'nope', 42, null, '', ':Party Parrot:'])).toEqual(['👍'])
  })

  it('cuts a row of eleven rather than refusing the whole of it', () => {
    const eleven = [...TEN, '🥳']
    expect(cleanQuickReactions(eleven)).toHaveLength(MAX_QUICK_REACTIONS)
    expect(cleanQuickReactions(eleven)).toEqual(TEN)
  })

  it("keeps one of the crew's own, written as a name", () => {
    expect(cleanQuickReactions([':party_parrot:', '🔥'])).toEqual([':party_parrot:', '🔥'])
  })

  it('refuses two emoji stuck together, since one press is one reaction', () => {
    expect(cleanQuickReactions(['👍🔥'])).toEqual([])
  })
})

describe('the row somebody chose', () => {
  it('is the four it ships with until somebody says otherwise', () => {
    expect(quickReactions()).toEqual([...QUICK_REACTIONS])
  })

  it('is kept where the person sits and never anywhere else', () => {
    setQuickReactions(['🔥'])
    expect(JSON.parse(storage.getItem(KEY) ?? 'null')).toEqual(['🔥'])
  })

  it('fills to the cap and the eleventh does nothing', () => {
    setQuickReactions([])
    for (const emoji of TEN) addQuickReaction(emoji)
    expect(quickReactions()).toEqual(TEN)

    addQuickReaction('🥳')
    expect(quickReactions()).toEqual(TEN)
    expect(quickReactions()).not.toContain('🥳')
  })

  it('never draws the same one twice', () => {
    setQuickReactions(['🔥'])
    addQuickReaction('🔥')
    expect(quickReactions()).toEqual(['🔥'])
  })

  it("takes one of the crew's own onto the row", () => {
    setQuickReactions([])
    addQuickReaction(':party_parrot:')
    expect(quickReactions()).toEqual([':party_parrot:'])
  })

  // An empty row is a real answer, so it is written down as one. Read as nothing
  // chosen, the four would come back the moment somebody cleared them.
  it('empties to none, and none stays none', () => {
    for (const emoji of [...QUICK_REACTIONS]) removeQuickReaction(emoji)
    expect(quickReactions()).toEqual([])
    expect(storage.getItem(KEY)).toBe('[]')
    expect(quickReactions()).toEqual([])
  })

  it('stands one in for another without moving it', () => {
    setQuickReactions(['🎉', '❤️', '👍'])
    replaceQuickReaction('❤️', '🔥')
    expect(quickReactions()).toEqual(['🎉', '🔥', '👍'])
  })

  it('leaves the row alone for a swap it cannot make', () => {
    setQuickReactions(['🎉', '🔥'])
    replaceQuickReaction('👀', '💯')
    expect(quickReactions()).toEqual(['🎉', '🔥'])

    replaceQuickReaction('🎉', '🔥')
    expect(quickReactions()).toEqual(['🎉', '🔥'])
  })
})

describe('the row on the tray', () => {
  it('draws the four it ships with, named the way a reaction is named', () => {
    mount()
    expect(row()).toEqual([...QUICK_REACTIONS].map(emoji => `React with ${reactionName(emoji)}`))
    expect(row()[0]).toBe('React with :tada:')
  })

  it('holds the divider back when there is nothing in front of it', () => {
    setQuickReactions([])
    mount()

    expect(row()).toEqual([])
    expect(divider()).toBeNull()
    expect(screen.getByLabelText('More reactions')).toBeTruthy()
  })

  it('stands the divider up as soon as there is one reaction to divide', () => {
    setQuickReactions(['🔥'])
    mount()

    expect(row()).toEqual(['React with :fire:'])
    expect(divider()).not.toBeNull()
  })

  it('keeps a row of ten inside the message rather than squashing it', () => {
    setQuickReactions(TEN)
    mount()

    expect(row()).toEqual(TEN.map(emoji => `React with ${reactionName(emoji)}`))
    expect(tray().className).toContain('flex-wrap')
    expect(tray().className).toContain('justify-end')
    for (const button of tray().querySelectorAll('button')) {
      expect(button.className).toContain('shrink-0')
    }
    // A second line grows away from the message rather than down over it, which
    // is the bottom edge being the pinned one.
    expect(tray().className).toContain('bottom-full')
    expect(tray().className).not.toContain('-top-4')
  })

  it('turns over the moment the setting does', () => {
    mount()
    expect(row()).toHaveLength(QUICK_REACTIONS.length)

    act(() => setQuickReactions(['🔥', '👀']))
    expect(row()).toEqual(['React with :fire:', 'React with :eyes:'])
  })

  it("reacts with one of the crew's own by the name it is written as", () => {
    setQuickReactions([':party_parrot:'])
    const reactToMessage = mount()

    fireEvent.click(screen.getByLabelText('React with :party_parrot:'))
    expect(reactToMessage).toHaveBeenCalledWith('message:m1', ':party_parrot:')
    expect(JSON.parse(storage.getItem('crew.emoji.recent') ?? '[]')[0]).toBe(':party_parrot:')
  })
})
