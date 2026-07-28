// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { useCrew, type ThreadMeta } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const thread = (ghost: boolean): ThreadMeta => ({
  id: 't1',
  agentId: 'a1',
  agentLabel: 'Fable',
  title: 'tidy the readme',
  createdBy: 'ALI',
  status: 'open',
  mode: 'build',
  ghost
})

const open = (ghost: boolean) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [
      {
        id: 'a1',
        label: 'Fable',
        provider: 'claude',
        ownerId: 'ali',
        ownerName: 'ALI',
        status: 'idle',
        runs: {},
        settings: {},
        fields: []
      }
    ],
    events: [],
    docs: {},
    threads: { t1: thread(ghost) },
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    chatCommands: [],
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: 't1',
    docsTarget: null
  })
  render(createElement(ThreadView, { threadId: 't1' }))
}

describe('a hidden thread says so at the head of it', () => {
  afterEach(cleanup)

  const shell = () => screen.getByRole('textbox').closest('.rounded-shell') as HTMLElement

  it('stands a white band behind the composer header rather than floating over the thread', () => {
    open(true)
    const band = screen.getByText('Ghost mode')
    expect(band.className).toContain('bg-fg')
    expect(band.className).not.toContain('absolute')
    expect(band.className).toContain('-mb-10')
    const header = band.nextElementSibling as HTMLElement
    expect(header.querySelector('[aria-label="Back to chat"]')).toBeTruthy()
  })

  it('carries the dashed box down into the composer', () => {
    open(true)
    expect(shell().className).toContain('border-dashed')
    expect(shell().className).toContain('bg-ink-900')
  })

  it('says nothing on an ordinary thread', () => {
    open(false)
    expect(screen.queryByText('Ghost mode')).toBeNull()
    expect(shell().className).not.toContain('border-dashed')
  })
})
