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

function boot(value: string) {
  useCrew.setState({ agents: [], docs: {}, pending: {} })
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
  return { textarea, overlay }
}

describe('the composer overlay', () => {
  it('keeps the scrollbar out of the text column so both layers wrap alike', () => {
    const { textarea, overlay } = boot('a long line\n'.repeat(40))
    expect(textarea.className).toContain('[scrollbar-width:none]')
    expect(overlay.className).not.toContain('pr-')
  })

  it('scrolls the highlights with the text', () => {
    const { textarea, overlay } = boot('a long line\n'.repeat(40))
    textarea.scrollTop = 120
    fireEvent.scroll(textarea)
    expect(overlay.scrollTop).toBe(120)
  })
})
