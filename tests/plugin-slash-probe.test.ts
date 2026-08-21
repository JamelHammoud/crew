// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { commandsIn } from '../src/shared/commands'
import { SlashMenu, useSlashCommands } from '../src/renderer/src/components/SlashCommands'

Element.prototype.scrollIntoView = () => {}

function Harness() {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const slash = useSlashCommands(value, setValue, () => {}, ref, commandsIn('chat'))
  return createElement(
    'div',
    null,
    createElement('textarea', {
      ref,
      value,
      placeholder: 'Message',
      onChange: (event: ChangeEvent<HTMLTextAreaElement>) => setValue(event.target.value),
      onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => slash.onKeyDown(event)
    }),
    createElement(SlashMenu, {
      matches: slash.matches,
      activeIndex: slash.activeIndex,
      onPick: slash.pick,
      onHover: slash.setActive
    })
  )
}

const type = (value: string) => fireEvent.change(screen.getByPlaceholderText('Message'), { target: { value } })

afterEach(cleanup)

describe('plugins outside the slash menu', () => {
  it('does not offer a plugin launcher', () => {
    render(createElement(Harness))
    type('/plugin')
    expect(screen.queryByRole('button', { name: /plugin/i })).toBeNull()
  })

  it('leaves a plugin-shaped line in the message', () => {
    render(createElement(Harness))
    type('/frontpages')
    fireEvent.keyDown(screen.getByPlaceholderText('Message'), { key: 'Enter' })
    expect((screen.getByPlaceholderText('Message') as HTMLTextAreaElement).value).toBe('/frontpages')
  })
})
