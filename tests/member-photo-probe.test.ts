// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/components/TopBar'
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

const people = () => within(screen.getByRole('heading', { name: 'People' }).closest('section') as HTMLElement)

const bar = () =>
  createElement(TopBar, { tab: 'chat' as const, onTab: vi.fn(), tasksOpen: false, onToggleTasks: vi.fn() })

describe('your own photo', () => {
  it('stands in for the initial wherever a person is drawn', () => {
    seed([{ ...jamel, avatar: 'me.png' }, ali])
    const { container } = render(createElement(Dashboard))

    const faces = container.querySelectorAll('img')
    expect(faces).toHaveLength(1)
    expect(faces[0].getAttribute('src')).toBe('http://10.0.0.2:2739/attachments/me.png')
    expect(screen.getByText('A')).toBeTruthy()
  })

  it('is yours to change and nobody else's', () => {
    seed([jamel, ali])
    render(createElement(Dashboard))

    expect(people().getAllByLabelText('Add a photo')).toHaveLength(1)
  })

  it('comes off from the row it is on', () => {
    const setMyPhoto = seed([{ ...jamel, avatar: 'me.png' }, ali])
    render(createElement(Dashboard))

    fireEvent.click(people().getByLabelText('Change photo'))
    fireEvent.click(screen.getByText('Remove photo'))
    expect(setMyPhoto).toHaveBeenCalledWith(null)
  })

  it('is offered in the profile menu, which only says remove once there is one', () => {
    const setMyPhoto = seed([jamel])
    const { rerender } = render(bar())

    fireEvent.click(screen.getByLabelText('Profile menu'))
    expect(screen.getByText('Add a photo')).toBeTruthy()
    expect(screen.queryByText('Remove photo')).toBeNull()

    useCrew.setState({ members: [{ ...jamel, avatar: 'me.png' }] })
    rerender(bar())
    fireEvent.click(screen.getByLabelText('Profile menu'))
    expect(screen.getByText('Change photo')).toBeTruthy()
    fireEvent.click(screen.getByText('Remove photo'))
    expect(setMyPhoto).toHaveBeenCalledWith(null)
  })
})
