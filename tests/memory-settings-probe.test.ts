// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Memory from '../src/renderer/src/components/settings/Memory'
import { MEMORY_LIMIT, type CrewMemory } from '../src/shared/memory'
import type { ClientMessage } from '../src/shared/protocol'
import { useCrew } from '../src/renderer/src/state/store'

const sent: ClientMessage[] = []

vi.mock('../src/renderer/src/api/ws', () => ({
  CrewSocket: class {
    send(msg: ClientMessage) {
      sent.push(msg)
    }
    connect() {}
    close() {}
    onMessage() {}
  }
}))

const held = (text: string, by = 'Jamel', byAgentId?: string): CrewMemory => ({
  id: text.toLowerCase().replace(/\s+/g, '-'),
  text,
  by,
  byAgentId,
  ts: 1
})

beforeEach(() => {
  sent.length = 0
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  useCrew.setState({
    selfId: 'jamel',
    selfName: 'Jamel',
    connection: 'online',
    members: [],
    agents: [],
    memories: [],
    memoryEnabled: false
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useCrew.setState({ memories: [] })
})

const card = () => screen.getByRole('dialog')

describe('the memory page', () => {
  it('starts off and can be turned on', () => {
    render(createElement(Memory))
    expect(screen.getByRole('heading', { name: 'Memory' })).toBeTruthy()
    const toggle = screen.getByRole('switch', { name: 'Let agents use memory' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('button', { name: 'Add a memory' })).toBeTruthy()

    fireEvent.click(toggle)
    expect(sent).toEqual([{ type: 'memory.set', enabled: true }])
  })

  it('writes one down', () => {
    render(createElement(Memory))
    fireEvent.click(screen.getByRole('button', { name: 'Add a memory' }))
    const field = within(card()).getByLabelText('Memory')
    fireEvent.change(field, { target: { value: '  The tests boot real servers  ' } })
    fireEvent.click(within(card()).getByRole('button', { name: 'Add' }))

    expect(sent).toEqual([{ type: 'memory.add', text: 'The tests boot real servers' }])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says on the card what came back, and stays open', () => {
    useCrew.setState({ memories: [held('The tests boot real servers')] })
    render(createElement(Memory))
    fireEvent.click(screen.getByRole('button', { name: 'Add a memory' }))
    fireEvent.change(within(card()).getByLabelText('Memory'), {
      target: { value: 'the tests   boot real servers' }
    })
    fireEvent.click(within(card()).getByRole('button', { name: 'Add' }))

    expect(sent).toEqual([])
    expect(within(card()).getByText('The crew already knows that one')).toBeTruthy()
  })

  it('says so when the crew is holding as many as it can', () => {
    useCrew.setState({ memories: Array.from({ length: MEMORY_LIMIT }, (_, at) => held(`Fact number ${at}`)) })
    render(createElement(Memory))
    fireEvent.click(screen.getByRole('button', { name: 'Add a memory' }))
    fireEvent.change(within(card()).getByLabelText('Memory'), { target: { value: 'One more thing' } })
    fireEvent.click(within(card()).getByRole('button', { name: 'Add' }))

    expect(sent).toEqual([])
    expect(within(card()).getByText(/Take one out before adding another/)).toBeTruthy()
  })

  it('rewrites one and takes one out, from the row it is about', () => {
    useCrew.setState({ memories: [held('The tests boot real servers')] })
    render(createElement(Memory))
    fireEvent.click(screen.getByRole('button', { name: 'More for The tests boot real servers' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit memory' }))
    fireEvent.change(within(card()).getByLabelText('Memory'), {
      target: { value: 'The tests boot real servers on loopback' }
    })
    fireEvent.click(within(card()).getByRole('button', { name: 'Save' }))
    expect(sent).toEqual([
      { type: 'memory.edit', memoryId: 'the-tests-boot-real-servers', text: 'The tests boot real servers on loopback' }
    ])

    fireEvent.click(screen.getByRole('button', { name: 'More for The tests boot real servers' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete memory' }))
    expect(sent[1]).toEqual({ type: 'memory.remove', memoryId: 'the-tests-boot-real-servers' })
  })

  it('wears the pet for an agent and the face for a person', () => {
    useCrew.setState({
      memories: [held('One a person wrote'), held('One an agent wrote', 'Fake', 'jamel:fake')]
    })
    render(createElement(Memory))
    expect(screen.getByText('One a person wrote')).toBeTruthy()
    expect(screen.getByText('Fake')).toBeTruthy()
  })

  it('holds no solid grey, since the card it stands on is glass', () => {
    useCrew.setState({ memories: [held('The tests boot real servers')] })
    const { container } = render(createElement(Memory))
    for (const el of container.querySelectorAll('*')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(/text-fg-(muted|faint|secondary)/)
    }
  })
})
