// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import PresenceStack from '../src/renderer/src/components/PresenceStack'
import { useCrew } from '../src/renderer/src/state/store'

Element.prototype.getAnimations ??= () => []

describe('probe', () => {
  it('prints', () => {
    useCrew.setState({
      selfId: 'self',
      members: [
        { id: 'self', name: 'Jamel', connected: true },
        { id: 'm1', name: 'Ali', connected: true }
      ],
      agents: [
        {
          id: 'a1',
          label: 'Bubbles',
          provider: 'claude',
          ownerId: 'self',
          ownerName: 'Jamel',
          status: 'busy',
          runs: {},
          settings: {},
          fields: []
        }
      ] as never,
      activePrompts: {},
      httpBase: ''
    })
    render(createElement(PresenceStack))
    const bar = screen.getByRole('button', { name: "Who's here" })
    for (const face of bar.querySelectorAll('span[style*="width"]')) {
      console.log('SPAN>', (face as HTMLElement).getAttribute('style'))
    }
    expect(true).toBe(true)
  })
})
