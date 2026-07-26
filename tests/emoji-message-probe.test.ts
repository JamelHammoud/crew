// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { EmojiText } from '../src/renderer/src/components/Emoji'
import Markdown from '../src/renderer/src/components/Markdown'
import { MentionText } from '../src/renderer/src/components/Mention'
import { useCrew } from '../src/renderer/src/state/store'

afterEach(cleanup)

function boot() {
  useCrew.setState({ agents: [], members: [], docs: {} })
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
