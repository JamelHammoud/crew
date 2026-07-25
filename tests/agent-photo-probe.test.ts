// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '../src/renderer/src/views/Dashboard'
import { useCrew } from '../src/renderer/src/state/store'
import type { PooledAgent } from '../src/shared/llm'

const agent: PooledAgent = {
  id: 'jamel/claude',
  label: 'Claude',
  provider: 'claude',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

function seed(one: PooledAgent, setAgentAvatar = vi.fn()) {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [one],
    activePrompts: {},
    httpBase: 'http://10.0.0.2:2739',
    setAgentAvatar
  })
  return setAgentAvatar
}

afterEach(cleanup)

describe('agent photos in the crew tab', () => {
  it('shows the uploaded photo in place of the generated icon', () => {
    seed({ ...agent, avatar: 'a-photo.png' })
    const { container } = render(createElement(Dashboard))

    const image = container.querySelector('img')
    expect(image?.getAttribute('src')).toBe('http://10.0.0.2:2739/attachments/a-photo.png')
    expect(container.querySelector('svg[viewBox="0 0 100 100"]')).toBeNull()
  })

  it('takes a photo off and lands back on the generated icon', () => {
    const setAgentAvatar = seed({ ...agent, avatar: 'a-photo.png' })
    const { container, rerender } = render(createElement(Dashboard))

    fireEvent.click(screen.getByLabelText('Change photo'))
    fireEvent.click(screen.getByText('Remove photo'))
    expect(setAgentAvatar).toHaveBeenCalledWith(agent.id, null)

    useCrew.setState({ agents: [agent] })
    rerender(createElement(Dashboard))
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg[viewBox="0 0 100 100"]')).toBeTruthy()
  })

  it('offers the upload straight away when there is no photo, and only to the owner', () => {
    seed(agent)
    const { rerender } = render(createElement(Dashboard))
    expect(screen.getByLabelText('Add a photo')).toBeTruthy()

    useCrew.setState({ agents: [{ ...agent, ownerId: 'ali', ownerName: 'ALI' }] })
    rerender(createElement(Dashboard))
    expect(screen.queryByLabelText('Add a photo')).toBeNull()
    expect(screen.queryByLabelText('Change photo')).toBeNull()
  })
})
