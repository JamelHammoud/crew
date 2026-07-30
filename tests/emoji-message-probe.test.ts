// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChatMessage from '../src/renderer/src/components/ChatMessage'
import { EmojiText } from '../src/renderer/src/components/Emoji'
import { onlyEmoji } from '../src/renderer/src/components/emojiTokens'
import Markdown from '../src/renderer/src/components/Markdown'
import { MentionText } from '../src/renderer/src/components/Mention'
import type { ThreadItem } from '../src/renderer/src/components/thread'
import { useCrew } from '../src/renderer/src/state/store'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function boot() {
  useCrew.setState({ agents: [], members: [], docs: {}, boards: [] })
}

const said = (text: string): ThreadItem => ({
  key: 'm1',
  ts: Date.parse('2026-07-21T12:00:00Z'),
  kind: 'message',
  author: 'Jamel',
  authorId: 'jamel',
  self: false,
  text,
  streaming: false
})

const words = (text: string): string => {
  boot()
  const { container } = render(createElement(ChatMessage, { item: said(text) }))
  return container.querySelector('p')?.className ?? ''
}

const sprites = (root: HTMLElement) =>
  [...root.querySelectorAll('span')].filter(span => span.style.backgroundImage.includes('64.png'))

describe('emoji in the feed', () => {
  it('draws a sent message from the twitter sheet', () => {
    boot()
    const { container } = render(createElement(MentionText, { text: 'well 😔' }))
    const drawn = sprites(container)

    expect(drawn).toHaveLength(1)
    expect(drawn[0].style.backgroundPosition).not.toBe('')
    expect(container.textContent).toBe('well 😔')
  })

  it('keeps a skin tone or a flag as one sprite', () => {
    boot()
    const { container } = render(createElement(MentionText, { text: '👍🏽 🇱🇧 👍' }))
    const drawn = sprites(container)

    expect(drawn).toHaveLength(3)
    expect(drawn[0].style.backgroundPosition).not.toBe(drawn[2].style.backgroundPosition)
  })

  it('draws an agent reply from the sheet and leaves code alone', () => {
    const { container } = render(createElement(Markdown, { text: 'shipped 🎉\n\n`grep 🎉 log`' }))

    expect(sprites(container)).toHaveLength(1)
    expect(container.querySelector('code')?.textContent).toBe('grep 🎉 log')
  })

  it('leaves text with no emoji as it was', () => {
    const { container } = render(createElement(EmojiText, { text: 'nothing to draw' }))
    expect(sprites(container)).toHaveLength(0)
    expect(container.textContent).toBe('nothing to draw')
  })
})
