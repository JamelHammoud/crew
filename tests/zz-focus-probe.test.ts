// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import MessageReactions from '../src/renderer/src/components/MessageReactions'
import { installLocalStorage } from './helpers/local-storage'

installLocalStorage()
afterEach(cleanup)

describe('probe', () => {
  it('focuses the search field when the picker opens', () => {
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
    fireEvent.click(screen.getByLabelText('More reactions'))
    const input = screen.getByPlaceholderText('Search emoji')
    console.log('active:', document.activeElement?.tagName, (document.activeElement as HTMLElement)?.getAttribute?.('placeholder'))
    console.log('popover visibility:', (input.closest('.glass') as HTMLElement)?.style.visibility)
    expect(document.activeElement).toBe(input)
  })
})
