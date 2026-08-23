// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

const tops = new WeakMap<HTMLElement, number>()
Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
  configurable: true,
  get(this: HTMLElement) {
    return tops.get(this) ?? 0
  },
  set(this: HTMLElement, value: number) {
    tops.set(this, value)
  }
})

const { default: Composer } = await import('../src/renderer/src/components/Composer')
const { useCrew } = await import('../src/renderer/src/state/store')

function boot(value: string, pending: Record<string, unknown[]> = {}) {
  useCrew.setState({ agents: [], docs: {}, pending: pending as never })
  const inputRef = createRef<HTMLTextAreaElement>() as React.RefObject<HTMLTextAreaElement>
  const view = render(
    createElement(Composer, {
      attachmentKey: 'chat',
      value,
      placeholder: 'Message the crew',
      inputRef,
      onChange: () => {},
      onKeyDown: () => {},
      onSend: () => {}
    })
  )
  const textarea = view.container.querySelector('textarea')!
  const overlay = view.container.querySelector('[aria-hidden="true"]') as HTMLElement
  const card = textarea.closest('.rounded-shell') as HTMLElement
  return { textarea, overlay, card, view }
}

describe('the composer overlay', () => {
  it('keeps the scrollbar out of the text column so both layers wrap alike', () => {
    const { textarea, overlay } = boot('a long line\n'.repeat(40))
    expect(textarea.className).toContain('no-scrollbar')
    expect(overlay.className).not.toContain('pr-')
  })

  it('scrolls the highlights with the text', () => {
    const { textarea, overlay } = boot('a long line\n'.repeat(40))
    textarea.scrollTop = 120
    fireEvent.scroll(textarea)
    expect(overlay.scrollTop).toBe(120)
  })

  it('paints the selection band under an emoji the highlight covers', () => {
    const { textarea, overlay } = boot('well 😔')
    textarea.focus()
    textarea.setSelectionRange(0, 7)
    fireEvent(document, new Event('selectionchange'))

    expect(overlay.querySelectorAll('.bg-selection')).toHaveLength(1)
  })

  it('leaves an emoji outside the highlight alone', () => {
    const { textarea, overlay } = boot('a 😔 b 😔')
    textarea.focus()
    textarea.setSelectionRange(0, 4)
    fireEvent(document, new Event('selectionchange'))
    const emoji = [...overlay.querySelectorAll('span.relative.inline-block')]

    expect(emoji[0].querySelector('.bg-selection')).not.toBeNull()
    expect(emoji[1].querySelector('.bg-selection')).toBeNull()
  })

  it('takes the band away with the highlight', () => {
    const { textarea, overlay } = boot('well 😔')
    textarea.focus()
    textarea.setSelectionRange(0, 7)
    fireEvent(document, new Event('selectionchange'))
    textarea.setSelectionRange(7, 7)
    fireEvent(document, new Event('selectionchange'))

    expect(overlay.querySelector('.bg-selection')).toBeNull()
  })

  it('draws emoji from the twitter sheet over the ones the system would draw', () => {
    const { overlay } = boot('well 😔')
    const sprite = overlay.querySelector('span[aria-hidden]') as HTMLElement

    expect(overlay.className).toContain('z-10')
    expect(sprite.style.backgroundImage).toMatch(/64\.png/)
    expect(sprite.parentElement?.className).toContain('bg-composer')
    expect(overlay.textContent).toContain('well 😔')
  })
})

describe('the room around what is typed', () => {
  it('belongs to the scroller, so a line scrolled past runs to the edge', () => {
    const { textarea, overlay, card } = boot('a long line\n'.repeat(40))

    expect(textarea.className).toContain('py-[var(--composer-scrim)]')
    expect(overlay.className).toContain('py-[var(--composer-scrim)]')
    expect(card.className).toContain('px-5 pb-5')
    expect(card.className).not.toMatch(/\bp-5\b|\bpt-5\b|\bpy-5\b/)
  })

  it('leaves the controls hard against the box, since the box carries its own', () => {
    const { textarea } = boot('a line')
    const rows = textarea.closest('.rounded-shell')!.lastElementChild as HTMLElement

    expect(rows.className).toContain('items-center')
    expect(rows.className).not.toMatch(/\bmt-\d/)
  })

  it('fades what crosses either edge, in the composer own surface', () => {
    const { card } = boot('a long line\n'.repeat(40))
    const top = card.querySelector('.composer-scrim') as HTMLElement
    const foot = card.querySelector('.composer-scrim-up') as HTMLElement

    expect(top.className).toContain('top-0')
    expect(top.className).toContain('bg-composer')
    expect(foot.className).toContain('bottom-0')
    expect(foot.className).toContain('bg-composer')
    for (const scrim of [top, foot]) {
      expect(scrim.className).toContain('pointer-events-none')
      expect(scrim.className).toContain('z-20')
    }
  })

  it('clips the card, or text run to the edge stands past the corner', () => {
    const { card } = boot('a line')

    expect(card.className).toContain('overflow-hidden')
  })

  it('gives the room back to the card once something is attached', () => {
    const { textarea, card } = boot('a line', {
      chat: [{ id: 'one', name: 'a.png', mime: 'image/png', size: 10, data: '' }]
    })

    expect(card.className).toContain('pt-5')
    expect(textarea.parentElement!.className).toContain('-mt-3')
  })
})
