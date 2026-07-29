// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {}

const agent: PooledAgent = {
  id: 'ali/claude',
  label: 'Claude 2',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: [],
  steerable: true
}

const started: SessionEvent = {
  id: 'thread-start',
  ts: 1,
  kind: 'thread.started',
  threadId: 'thread-1',
  agentId: agent.id,
  agentLabel: agent.label,
  title: 'tidy the readme',
  byName: 'ALI'
}

const running: SessionEvent = {
  id: 'agent-start',
  ts: 2,
  kind: 'agent.start',
  promptId: 'prompt-1',
  agentId: agent.id,
  agentLabel: agent.label,
  promptText: 'tidy the readme',
  byName: 'ALI',
  threadId: 'thread-1'
}

const open = ({ mid = false, sendChat = vi.fn() } = {}) => {
  useCrew.setState({
    connection: 'online',
    selfId: 'ali',
    selfName: 'ALI',
    members: [{ id: 'ali', name: 'ALI', connected: true }],
    agents: [agent],
    events: mid ? [started, running] : [started],
    docs: {},
    threads: {
      'thread-1': {
        id: 'thread-1',
        agentId: agent.id,
        agentLabel: agent.label,
        title: 'tidy the readme',
        createdBy: 'ALI',
        status: 'open',
        mode: 'build'
      }
    },
    threadPrompts: mid ? { 'thread-1': 'prompt-1' } : {},
    threadDrafts: {},
    threadCommands: {},
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: 'thread-1',
    sendChat
  })
  render(createElement(ThreadView, { threadId: 'thread-1' }))
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

describe('commands in a thread', () => {
  afterEach(cleanup)

  it('offers the thread its own commands and none of the chat’s', () => {
    const composer = open({ mid: true })

    fireEvent.change(composer, { target: { value: '/' } })
    expect(screen.getByText('/steer')).toBeTruthy()
    expect(screen.getByText('/queue')).toBeTruthy()
    expect(screen.getByText('/btw')).toBeTruthy()
    expect(screen.queryByText('/plan')).toBeNull()
    expect(screen.queryByText('/ghost')).toBeNull()
  })

  it('leaves steering and queueing out while there is no turn to go into', () => {
    const composer = open()

    fireEvent.change(composer, { target: { value: '/' } })
    expect(screen.getByText('/btw')).toBeTruthy()
    expect(screen.queryByText('/steer')).toBeNull()
    expect(screen.queryByText('/queue')).toBeNull()
  })

  it('holds one command at a time, so picking another takes the place of it', () => {
    const composer = open({ mid: true })

    fireEvent.change(composer, { target: { value: '/queue ' } })
    expect(composer.value).toBe('')
    expect(screen.getByLabelText('Remove Queue')).toBeTruthy()

    fireEvent.change(composer, { target: { value: '/steer ' } })
    expect(screen.getByLabelText('Remove Steer')).toBeTruthy()
    expect(screen.queryByLabelText('Remove Queue')).toBeNull()
    expect(useCrew.getState().threadCommands['thread-1']).toEqual(['steer'])

    fireEvent.keyDown(composer, { key: 'Backspace' })
    expect(screen.queryByLabelText('Remove Steer')).toBeNull()
  })

  it('says on the button where the message is going', () => {
    const composer = open({ mid: true })
    const write = (value: string) => fireEvent.change(composer, { target: { value } })

    write('and the changelog')
    expect(screen.getByLabelText('Steer')).toBeTruthy()

    write('/queue ')
    write('and the changelog')
    expect(screen.getByLabelText('Send')).toBeTruthy()

    write('/btw ')
    expect(composer.placeholder).toBe('Ask about this thread, off to the side')
    write('what is this file for')
    expect(screen.getByLabelText('Ask')).toBeTruthy()
  })

  it('sends the command beside the message rather than in it', () => {
    const sendChat = vi.fn()
    const composer = open({ mid: true, sendChat })

    fireEvent.change(composer, { target: { value: '/queue ' } })
    fireEvent.change(composer, { target: { value: 'and the changelog' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat).toHaveBeenCalledWith('and the changelog', 'thread-1', undefined, undefined, undefined, ['queue'])
  })

  it('leaves a command written inside a sentence alone', () => {
    const sendChat = vi.fn()
    const composer = open({ mid: true, sendChat })

    fireEvent.change(composer, { target: { value: 'do it and /queue the rest' } })
    expect(composer.value).toBe('do it and /queue the rest')
    fireEvent.click(screen.getByLabelText('Steer'))

    expect(sendChat).toHaveBeenCalledWith(
      'do it and /queue the rest',
      'thread-1',
      undefined,
      undefined,
      undefined,
      undefined
    )
  })

  it('drops a chip the thread can no longer honor when the turn ends', () => {
    const composer = open({ mid: true })
    fireEvent.change(composer, { target: { value: '/queue ' } })
    expect(screen.getByLabelText('Remove Queue')).toBeTruthy()

    cleanup()
    useCrew.setState({ events: [started], threadPrompts: {} })
    render(createElement(ThreadView, { threadId: 'thread-1' }))

    expect(screen.queryByLabelText('Remove Queue')).toBeNull()
    expect(screen.getByLabelText('Send')).toBeTruthy()
  })

  it('stands a question asked on the side in the panel, under what was asked', () => {
    open()
    useBrowser.setState({ tabs: [], activeTabId: null })
    useCrew.setState({
      events: [
        started,
        {
          id: 'aside-start',
          ts: 5,
          kind: 'thread.started',
          threadId: 'aside-1',
          agentId: agent.id,
          agentLabel: agent.label,
          title: 'what does this file do',
          byName: 'ALI',
          ghost: true,
          aside: 'thread-1'
        },
        {
          id: 'aside-end',
          ts: 6,
          kind: 'agent.end',
          promptId: 'prompt-2',
          agentId: agent.id,
          agentLabel: agent.label,
          ok: true,
          text: 'It draws the panel.',
          threadId: 'aside-1'
        }
      ],
      threads: {
        ...useCrew.getState().threads,
        'aside-1': {
          id: 'aside-1',
          agentId: agent.id,
          agentLabel: agent.label,
          title: 'what does this file do',
          createdBy: 'ALI',
          status: 'open',
          mode: 'build',
          ghost: true,
          aside: 'thread-1'
        }
      }
    })
    useBrowser.getState().openAside('aside-1', 'what does this file do')
    cleanup()

    render(createElement(BrowserPanel))
    expect(screen.getByText('what does this file do')).toBeTruthy()
    expect(screen.getByText('It draws the panel.')).toBeTruthy()
  })
})
