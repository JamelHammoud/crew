// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import MessagePreview from '../src/renderer/src/components/MessagePreview'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const LINES = 5

const WHOLE = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'].join('\n')

const stand = (text: string) =>
  render(createElement(MessagePreview, { text, lines: LINES, className: 'text-base' })).container

const shown = (box: HTMLElement) =>
  Array.from(box.querySelectorAll('.preview-line')).filter(row => (row as HTMLElement).style.display !== 'none')

afterEach(cleanup)

describe('a preview that was cut', () => {
  it('says so with a way in rather than an ellipsis alone', () => {
    const box = stand(WHOLE)
    expect(shown(box)).toHaveLength(LINES)
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy()
  })

  it('stands the whole of it up where it is, and puts it back', () => {
    const box = stand(WHOLE)
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(shown(box)).toHaveLength(7)
    expect(box.querySelector('[data-more]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(shown(box)).toHaveLength(LINES)
    expect(box.querySelector('[data-more]')).toBeTruthy()
  })

  it('leaves a message that fits alone', () => {
    stand(['one', 'two'].join('\n'))
    expect(screen.queryByRole('button')).toBeNull()
  })
})
