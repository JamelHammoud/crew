// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Emoji, { EmojiText } from '../src/renderer/src/components/Emoji'
import EmojiPicker from '../src/renderer/src/components/EmojiPicker'
import { holdCustomEmoji, lookupCustomEmoji } from '../src/renderer/src/components/customEmojiSheet'
import { emojifyHtml } from '../src/renderer/src/components/emojiHtml'
import { tokenizeEmoji } from '../src/renderer/src/components/emojiTokens'
import type { CustomEmoji } from '../src/shared/customEmoji'
import { installLocalStorage } from './helpers/local-storage'

const storage = installLocalStorage()

const BASE = 'http://127.0.0.1:4321'

const one = (name: string, file: string): CustomEmoji => ({
  id: `id-${name}`,
  name,
  file,
  by: 'sam',
  ts: 1
})

const SHEET = [one('shipit', 'a.gif'), one('parrot', 'b.png')]

const hold = (list: CustomEmoji[] = SHEET, base = BASE) => holdCustomEmoji(list, base)

afterEach(() => {
  cleanup()
  storage.clear()
  hold([], '')
})

describe('an emoji the crew added, drawn', () => {
  it('reads a name off the sheet only once there is somewhere to read the picture from', () => {
    hold(SHEET, '')
    expect(lookupCustomEmoji('shipit')).toBeUndefined()

    hold()
    expect(lookupCustomEmoji('shipit')?.url).toBe(`${BASE}/emoji/a.gif`)
    expect(lookupCustomEmoji('nobody')).toBeUndefined()
  })

  it('finds the names the crew has in a sentence and leaves the rest as words', () => {
    hold()
    const tokens = tokenizeEmoji('ship it :shipit: and :nope: too 🎉 a::b :')

    expect(tokens.filter(token => token.kind === 'custom').map(token => token.text)).toEqual([':shipit:'])
    expect(tokens.filter(token => token.kind === 'emoji').map(token => token.text)).toEqual(['🎉'])
    // A name nobody here has, a pair of colons and a bare one are all just words.
    expect(
      tokens
        .filter(token => token.kind === 'text')
        .map(token => token.text)
        .join('')
    ).toBe('ship it  and :nope: too  a::b :')
  })

  it('draws one as its own picture, and an unknown name as the words it was written in', () => {
    hold()
    const { container } = render(createElement(Emoji, { char: ':shipit:', size: 24 }))
    const picture = container.querySelector('img') as HTMLImageElement

    expect(picture.getAttribute('src')).toBe(`${BASE}/emoji/a.gif`)
    expect(picture.style.width).toBe('24px')

    cleanup()
    const plain = render(createElement(Emoji, { char: ':nobody:' }))
    expect(plain.container.querySelector('img')).toBeNull()
    expect(plain.container.textContent).toBe(':nobody:')
  })

  it('turns a name already on screen into a picture the moment the crew has it', () => {
    hold([])
    const { container } = render(createElement(EmojiText, { text: 'ship it :shipit:' }))
    expect(container.querySelector('img')).toBeNull()

    // What draws it is memoized on the words, and the words have not changed, so
    // the sheet is what has to say it moved.
    act(() => hold())
    expect(container.querySelector('img')?.getAttribute('src')).toBe(`${BASE}/emoji/a.gif`)
  })

  it('sends the name along with the picture, so what is copied out is the name', () => {
    hold()
    const { container } = render(createElement(EmojiText, { text: 'nice :parrot:' }))

    expect(container.querySelector('img')?.getAttribute('src')).toBe(`${BASE}/emoji/b.png`)
    expect(container.querySelector('.sr-only')?.textContent).toBe(':parrot:')
  })

  it('draws one in written prose and never inside a fence', () => {
    hold()
    const root = document.createElement('div')
    root.innerHTML = '<p>done :shipit:</p><pre><code>grep :shipit:</code></pre>'
    emojifyHtml(root)

    const paragraph = root.querySelector('p') as HTMLElement
    expect(paragraph.querySelector('img')?.getAttribute('src')).toBe(`${BASE}/emoji/a.gif`)
    expect(paragraph.querySelector('.sr-only')?.textContent).toBe(':shipit:')
    // Code is quoted as it was written.
    expect(root.querySelector('pre')?.textContent).toBe('grep :shipit:')
    expect(root.querySelector('pre img')).toBeNull()
  })
})

describe('an emoji the crew added, picked', () => {
  const openPicker = (onPick = vi.fn()) => {
    render(createElement(EmojiPicker, { selected: new Set<string>(), onPick }))
    return onPick
  }

  it('stands at the head of the picker and hands back the name', () => {
    hold()
    const onPick = openPicker()
    const crew = screen.getByText('Crew')

    fireEvent.click(within(crew.parentElement as HTMLElement).getByLabelText('React with :shipit:'))
    expect(onPick).toHaveBeenCalledWith(':shipit:')
  })

  it('is left out entirely when the crew has none, rather than standing empty', () => {
    hold([])
    openPicker()

    expect(screen.queryByText('Crew')).toBeNull()
    expect(screen.getByText('Frequently used')).toBeTruthy()
  })

  it('searches what the crew added ahead of the sheet', () => {
    hold([one('tada', 'c.gif')])
    const onPick = openPicker()

    fireEvent.change(screen.getByPlaceholderText('Search emoji'), { target: { value: 'tada' } })
    const results = screen.getByText('Results').parentElement as HTMLElement
    const cells = within(results).getAllByRole('button')

    // A name somebody chose here beats the sheet's own word for it.
    expect(cells[0].getAttribute('aria-label')).toBe('React with :tada:')
    fireEvent.click(cells[0])
    expect(onPick).toHaveBeenCalledWith(':tada:')
  })
})
