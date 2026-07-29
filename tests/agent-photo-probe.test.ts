// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Agents from '../src/renderer/src/components/settings/Agents'
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
  window.crew = { agentCapabilities: vi.fn().mockResolvedValue([]) } as unknown as typeof window.crew
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

const section = () => screen.getByRole('heading', { name: 'Agents' }).closest('section') as HTMLElement
const agents = () => within(section())

describe('agent photos in the settings', () => {
  it('shows the uploaded photo in place of the generated icon', () => {
    seed({ ...agent, avatar: 'a-photo.png' })
    render(createElement(Agents))

    expect(section().querySelector('img')?.getAttribute('src')).toBe('http://10.0.0.2:2739/attachments/a-photo.png')
    expect(section().querySelector('svg[viewBox="0 0 100 100"]')).toBeNull()
  })

  it('leaves the picture its own transparency', () => {
    seed({ ...agent, avatar: 'a-photo.png' })
    render(createElement(Agents))

    const face = section().querySelector('img') as HTMLImageElement
    expect(face.className).toContain('rounded-full')
    expect(face.className).toContain('object-cover')
    expect(face.className).not.toMatch(/\bbg-/)
    expect(face.style.backgroundColor).toBe('')
  })

  it('takes a photo off and lands back on the generated icon', () => {
    const setAgentAvatar = seed({ ...agent, avatar: 'a-photo.png' })
    const { rerender } = render(createElement(Agents))

    fireEvent.click(agents().getByLabelText('Change photo'))
    fireEvent.click(screen.getByText('Remove photo'))
    expect(setAgentAvatar).toHaveBeenCalledWith(agent.id, null)

    useCrew.setState({ agents: [agent] })
    rerender(createElement(Agents))
    expect(section().querySelector('img')).toBeNull()
    expect(section().querySelector('svg[viewBox="0 0 100 100"]')).toBeTruthy()
  })

  it('offers the upload straight away when there is no photo, and only to the owner', () => {
    seed(agent)
    const { rerender } = render(createElement(Agents))
    expect(agents().getByLabelText('Add a photo')).toBeTruthy()

    useCrew.setState({ agents: [{ ...agent, ownerId: 'ali', ownerName: 'ALI' }] })
    rerender(createElement(Agents))
    expect(agents().queryByLabelText('Add a photo')).toBeNull()
    expect(agents().queryByLabelText('Change photo')).toBeNull()
  })
})
