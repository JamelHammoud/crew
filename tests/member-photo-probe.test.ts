// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '../src/renderer/src/views/Dashboard'
import { useCrew } from '../src/renderer/src/state/store'
import type { MemberInfo } from '../src/shared/protocol'

const jamel: MemberInfo = { id: 'jamel', name: 'Jamel', connected: true }
const ali: MemberInfo = { id: 'ali', name: 'ALI', connected: true }

function seed(members: MemberInfo[], setMyPhoto = vi.fn()) {
  window.crew = { agentCapabilities: vi.fn().mockResolvedValue([]) } as unknown as typeof window.crew
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members,
    agents: [],
    activePrompts: {},
    httpBase: 'http://10.0.0.2:2739',
    setMyPhoto
  })
  return setMyPhoto
}

afterEach(cleanup)

const people = () => screen.getByRole('heading', { name: 'People' }).closest('section') as HTMLElement

describe('a person photo in the crew tab', () => {
  it('stands in for the initial, and only for whoever wears one', () => {
    seed([{ ...jamel, avatar: 'me.png' }, ali])
    render(createElement(Dashboard))

    const faces = people().querySelectorAll('img')
    expect(faces).toHaveLength(1)
    expect(faces[0].getAttribute('src')).toBe('http://10.0.0.2:2739/attachments/me.png')
    expect(within(people()).getByText('A')).toBeTruthy()
  })

  it('is yours to change, and nobody else here can be touched', () => {
    seed([jamel, ali])
    render(createElement(Dashboard))

    expect(within(people()).getAllByLabelText('Add a photo')).toHaveLength(1)
  })

  it('comes off the row it is on and lands back on the initial', () => {
    const setMyPhoto = seed([{ ...jamel, avatar: 'me.png' }, ali])
    const { rerender } = render(createElement(Dashboard))

    fireEvent.click(within(people()).getByLabelText('Change photo'))
    fireEvent.click(screen.getByText('Remove photo'))
    expect(setMyPhoto).toHaveBeenCalledWith(null)

    useCrew.setState({ members: [jamel, ali] })
    rerender(createElement(Dashboard))
    expect(people().querySelector('img')).toBeNull()
    expect(within(people()).getByText('J')).toBeTruthy()
  })
})
