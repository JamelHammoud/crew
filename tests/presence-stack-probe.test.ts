// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import PresenceStack from '../src/renderer/src/components/PresenceStack'
import { useCrew } from '../src/renderer/src/state/store'
import type { AgentStatus, PooledAgent } from '../src/shared/llm'
import type { MemberInfo } from '../src/shared/protocol'

Element.prototype.getAnimations ??= () => []

const member = (id: string, name: string, connected: boolean): MemberInfo => ({ id, name, connected })

const agent = (id: string, label: string, status: AgentStatus): PooledAgent => ({
  id,
  label,
  provider: 'claude',
  ownerId: 'self',
  ownerName: 'Jamel',
  status,
  runs: {},
  settings: {},
  fields: []
})

function here(members: MemberInfo[], agents: PooledAgent[]): void {
  useCrew.setState({ selfId: 'self', members, agents, httpBase: '' })
}

describe('presence stack', () => {
  beforeEach(() => {
    here([], [])
  })

  afterEach(cleanup)

  it('shows two faces and a count for everyone else', () => {
    here(
      [member('self', 'Jamel', true), member('m1', 'Ali', true), member('m2', 'Bo', true)],
      [agent('a1', 'Bubbles', 'busy')]
    )
    render(createElement(PresenceStack))

    expect(screen.getByRole('button', { name: "Who's here" }).textContent).toBe('AB+1')
  })

  it('leaves out people who are away and agents that are not working', () => {
    here(
      [member('self', 'Jamel', true), member('m1', 'Ali', true), member('m2', 'Sam', false)],
      [agent('a1', 'Bubbles', 'busy'), agent('a2', 'Kimi', 'idle'), agent('a3', 'Codex', 'offline')]
    )
    render(createElement(PresenceStack))
    fireEvent.click(screen.getByRole('button', { name: "Who's here" }))

    expect(screen.getByText('Ali')).toBeTruthy()
    expect(screen.getByText('Bubbles')).toBeTruthy()
    expect(screen.queryByText('Sam')).toBeNull()
    expect(screen.queryByText('Kimi')).toBeNull()
    expect(screen.queryByText('Codex')).toBeNull()
    expect(screen.queryByText('Jamel')).toBeNull()
  })

  it('opens and closes the full list on click', () => {
    here([member('self', 'Jamel', true), member('m1', 'Ali', true)], [])
    render(createElement(PresenceStack))
    const button = screen.getByRole('button', { name: "Who's here" })

    expect(screen.queryByText('Ali')).toBeNull()
    fireEvent.click(button)
    expect(screen.getByText('Ali')).toBeTruthy()
    fireEvent.click(button)
    expect(screen.queryByText('Ali')).toBeNull()
  })

  it('draws faces the same size as the top bar avatar', () => {
    here([member('self', 'Jamel', true), member('m1', 'Ali', true)], [agent('a1', 'Bubbles', 'busy')])
    render(createElement(PresenceStack))
    const bar = screen.getByRole('button', { name: "Who's here" })

    for (const face of bar.querySelectorAll('span[style*="width"]')) {
      expect((face as HTMLElement).style.width).toBe('40px')
    }
    expect(bar.querySelectorAll('.w-10.h-10').length).toBe(2)
  })

  it('shows nothing when nobody else is here', () => {
    here([member('self', 'Jamel', true), member('m2', 'Sam', false)], [agent('a2', 'Kimi', 'idle')])
    const { container } = render(createElement(PresenceStack))

    expect(container.firstChild).toBeNull()
  })
})
