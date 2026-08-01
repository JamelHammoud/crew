// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { expect, it } from 'vitest'
import { holdCustomEmoji } from '../src/renderer/src/components/customEmojiSheet'
import ThreadAsk from '../src/renderer/src/components/ThreadAsk'
import { useCrew } from '../src/renderer/src/state/store'

it('dbg', () => {
  holdCustomEmoji([{ id: 'e1', name: 'shipit', file: 'a.gif', by: 'j', ts: 1 }], 'http://x')
  useCrew.setState({ agents: [] })
  const { container } = render(createElement(ThreadAsk, { ask: 'made with ❤️ :shipit: ok', whole: 'made with ❤️ :shipit: ok', onJump: () => {} }))
  console.log(container.innerHTML)
  expect(1).toBe(1)
})
