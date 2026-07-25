// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupEmoji, searchEmoji } from '../src/renderer/src/components/emojiData'
import MessageReactions from '../src/renderer/src/components/MessageReactions'
import { useCrew } from '../src/renderer/src/state/store'
import { isReactionEmoji } from '../src/shared/reactions'

const defaultReactToMessage = useCrew.getState().reactToMessage

const mount = (reactToMessage = vi.fn()) => {
  useCrew.setState({ reactToMessage })
  render(
    createElement(
      'div',
      { className: 'group/message' },
      createElement(MessageReactions, {
        targetId: 'message:m1',
        reactions: [{ emoji: '❤️', count: 1, names: ['Ali'], self: true }],
        deletable: false,
        onDelete: () => {}
      })
    )
  )
  return reactToMessage
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.clear()
  useCrew.setState({ reactToMessage: defaultReactToMessage })
})

describe('emoji reactions', () => {
  it('draws reactions from the twitter emoji sheet instead of the system font', () => {
    mount()
    const sprite = screen.getByLabelText('❤️, 1 reaction').querySelector('span[aria-hidden]') as HTMLElement
    const entry = lookupEmoji('❤️')!

    expect(sprite.style.backgroundImage).toMatch(/64\.png/)
    expect(sprite.style.backgroundPosition).toBe(
      `${(entry.x / 61) * 100}% ${(entry.y / 61) * 100}%`
    )
  })

  it('opens the full set from the more reactions button and reacts from a search', () => {
    const reactToMessage = mount()
    fireEvent.click(screen.getByLabelText('More reactions'))

    fireEvent.change(screen.getByPlaceholderText('Search emoji'), { target: { value: 'tada' } })
    fireEvent.click(screen.getByLabelText('React with :tada:'))

    expect(reactToMessage).toHaveBeenCalledWith('message:m1', '🎉')
    expect(screen.queryByPlaceholderText('Search emoji')).toBeNull()
    expect(JSON.parse(localStorage.getItem('crew.emoji.recent') ?? '[]')[0]).toBe('🎉')
  })

  it('reaches emoji the quick row never had', () => {
    const reactToMessage = mount()
    fireEvent.click(screen.getByLabelText('More reactions'))

    fireEvent.change(screen.getByPlaceholderText('Search emoji'), { target: { value: 'melting' } })
    fireEvent.click(screen.getByLabelText('React with :melting_face:'))

    expect(reactToMessage).toHaveBeenCalledWith('message:m1', '🫠')
  })

  it('holds the more reactions tooltip back while the picker is open', () => {
    vi.useFakeTimers()
    mount()
    const button = screen.getByLabelText('More reactions')

    fireEvent.mouseEnter(button.parentElement!)
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getAllByText('More reactions').length).toBeGreaterThan(0)

    fireEvent.mouseLeave(button.parentElement!)
    fireEvent.click(button)
    fireEvent.mouseEnter(button.parentElement!)
    act(() => vi.advanceTimersByTime(400))

    expect(screen.queryByText('More reactions')).toBeNull()
  })

  it('ranks a shortcode above a loose match and knows what a reaction may be', () => {
    expect(searchEmoji('joy')[0].char).toBe('😂')
    expect(searchEmoji('thumbsup')[0].char).toBe('👍')
    expect(isReactionEmoji('🫠')).toBe(true)
    expect(isReactionEmoji('🏳️‍🌈')).toBe(true)
    expect(isReactionEmoji('nope')).toBe(false)
    expect(isReactionEmoji('👍👍')).toBe(false)
  })
})
