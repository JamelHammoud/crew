// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BrowserPanel from '../src/renderer/src/components/BrowserPanel'
import QueueBar from '../src/renderer/src/components/QueueBar'
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
    expect(screen.getByText('/goal')).toBeTruthy()
    expect(screen.queryByText('/plan')).toBeNull()
    expect(screen.queryByText('/ghost')).toBeNull()
  })

  it('applies an available thread command from the plus menu', () => {
    const composer = open({ mid: true })

    fireEvent.change(composer, { target: { value: 'and the changelog' } })
    fireEvent.click(screen.getByLabelText('Add to your message'))
    fireEvent.click(screen.getByText('Commands'))

    expect(screen.getByText('/steer')).toBeTruthy()
    expect(screen.getByText('/queue')).toBeTruthy()
    expect(screen.queryByText('/plan')).toBeNull()
    fireEvent.click(screen.getByText('/queue'))

    expect(composer.value).toBe('and the changelog')
    expect(useCrew.getState().threadCommands['thread-1']).toEqual(['queue'])
    expect(screen.getByLabelText('Remove Queue')).toBeTruthy()
    expect(document.activeElement).toBe(composer)
  })

  it('sends a goal beside the next turn', () => {
    const sendChat = vi.fn()
    const composer = open({ sendChat })

    fireEvent.change(composer, { target: { value: '/goal ' } })
    expect(screen.getByLabelText('Remove Goal')).toBeTruthy()
    fireEvent.change(composer, { target: { value: 'finish the migration' } })
    fireEvent.click(screen.getByLabelText('Send'))

    expect(sendChat).toHaveBeenCalledWith('finish the migration', 'thread-1', undefined, undefined, undefined, ['goal'])
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

  it('offers a fork whether or not there is a turn running', () => {
    const composer = open()
    fireEvent.change(composer, { target: { value: '/' } })
    expect(screen.getByText('/fork')).toBeTruthy()

    cleanup()
    const mid = open({ mid: true })
    fireEvent.change(mid, { target: { value: '/' } })
    expect(screen.getByText('/fork')).toBeTruthy()
  })

  it('says on the button that a fork is going somewhere else', () => {
    const composer = open({ mid: true })

    fireEvent.change(composer, { target: { value: '/fork ' } })
    expect(screen.getByLabelText('Remove Fork')).toBeTruthy()
    expect(composer.placeholder).toBe('Carry on from here')
    fireEvent.change(composer, { target: { value: 'try it with the header on top' } })
    expect(screen.getByLabelText('Fork')).toBeTruthy()
  })

  it('sends a fork beside the message, and as a reply to nothing in the thread', () => {
    const sendChat = vi.fn()
    const composer = open({ mid: true, sendChat })

    fireEvent.change(composer, { target: { value: '/fork ' } })
    fireEvent.change(composer, { target: { value: 'try it with the header on top' } })
    fireEvent.click(screen.getByLabelText('Fork'))

    expect(sendChat).toHaveBeenCalledWith(
      'try it with the header on top',
      'thread-1',
      undefined,
      undefined,
      undefined,
      ['fork']
    )
  })

  it('says at the head of a fork where the talk before it is', () => {
    open()
    cleanup()
    useCrew.setState({
      openThreadId: 'thread-2',
      events: [started, { ...started, id: 'fork-start', ts: 9, threadId: 'thread-2', title: 'the header on top' }],
      threads: {
        ...useCrew.getState().threads,
        'thread-2': {
          id: 'thread-2',
          agentId: agent.id,
          agentLabel: agent.label,
          title: 'the header on top',
          createdBy: 'ALI',
          status: 'open',
          mode: 'build',
          forkedFrom: 'thread-1'
        }
      }
    })
    render(createElement(ThreadView, { threadId: 'thread-2' }))

    const back = screen.getByText('Carried on from tidy the readme')
    fireEvent.click(back)
    expect(useCrew.getState().openThreadId).toBe('thread-1')
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

  const aside = () => {
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
  }

  it('stands a question asked on the side in the panel, under what was asked', () => {
    open()
    aside()

    expect(screen.getByText('what does this file do')).toBeTruthy()
    expect(screen.getByText('It draws the panel.')).toBeTruthy()
  })

  it('takes the next question where the last one was answered', () => {
    const sendChat = vi.fn()
    open({ sendChat })
    aside()

    const composer = screen.getByPlaceholderText('Ask something else') as HTMLTextAreaElement
    fireEvent.change(composer, { target: { value: 'and who wrote it' } })
    fireEvent.click(screen.getByLabelText('Ask'))

    // Into the conversation on the side, never into the thread it is about.
    expect(sendChat).toHaveBeenCalledWith('and who wrote it', 'aside-1')
  })
})

describe('queued message cards', () => {
  afterEach(cleanup)

  it('keeps the message shape and collects its actions into one menu', () => {
    useCrew.setState({ httpBase: 'http://127.0.0.1:1234' })
    const edit = vi.fn()
    const move = vi.fn()
    const remove = vi.fn()
    const send = vi.fn()
    render(
      createElement(QueueBar, {
        items: [
          {
            promptId: 'p1',
            author: 'Jamel',
            self: true,
            sendable: true,
            text: 'first line\nsecond line',
            attachments: [
              {
                id: 'file-1',
                name: 'room.png',
                mime: 'image/png',
                size: 12,
                file: 'file-1.png'
              }
            ],
            replyTo: {
              targetId: 'message:m1',
              authorId: 'ali',
              authorName: 'Ali',
              text: 'Try the other wall'
            }
          },
          { promptId: 'p2', author: 'Jamel', self: true, sendable: true, text: 'after that' }
        ],
        onEdit: edit,
        onRemove: remove,
        onSend: send,
        onMove: move
      })
    )

    fireEvent.click(screen.getByText('2 messages queued'))
    expect(screen.getByText('first line second line')).toBeTruthy()
    expect(screen.getByText('Replying to Ali')).toBeTruthy()
    expect(screen.getByLabelText('Open room.png')).toBeTruthy()

    fireEvent.click(screen.getAllByLabelText('More for queued message')[0])
    fireEvent.click(screen.getByText('Send now'))
    expect(send).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getAllByLabelText('More for queued message')[0])
    fireEvent.click(screen.getByText('Edit in composer'))
    expect(edit).toHaveBeenCalledWith('p1')
    fireEvent.contextMenu(screen.getByText('after that'), { clientX: 240, clientY: 180 })
    fireEvent.click(screen.getByText('Remove from queue'))
    expect(remove).toHaveBeenCalledWith('p2')
    expect(screen.queryByLabelText('Move queued message later')).toBeNull()
    expect(screen.queryByLabelText('Move queued message earlier')).toBeNull()
  })

  it('reorders messages by dragging their rows', () => {
    const move = vi.fn()
    const { container } = render(
      createElement(QueueBar, {
        items: [
          { promptId: 'p1', author: 'Jamel', self: true, sendable: true, text: 'first' },
          { promptId: 'p2', author: 'Jamel', self: true, sendable: true, text: 'second' }
        ],
        onEdit: vi.fn(),
        onRemove: vi.fn(),
        onSend: vi.fn(),
        onMove: move
      })
    )

    fireEvent.click(screen.getByText('2 messages queued'))
    const strip = container.querySelector('.overflow-y-auto') as HTMLElement
    const rows = [...container.querySelectorAll<HTMLElement>('[data-reorder]')]
    strip.getBoundingClientRect = () => ({ top: 0, left: 0, width: 600, height: 200 }) as DOMRect
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () => ({ top: 8 + index * 48, left: 0, width: 600, height: 40 }) as DOMRect
    })
    fireEvent.pointerDown(rows[0]!.firstElementChild!.firstElementChild!, {
      button: 0,
      clientX: 80,
      clientY: 20
    })
    fireEvent.pointerMove(window, { clientX: 80, clientY: 120 })
    expect(document.body.style.cursor).toBe('grabbing')
    fireEvent.pointerUp(window)

    expect(move).toHaveBeenCalledWith('p1', 1)
  })

  it('previews the full message on hover', async () => {
    vi.useFakeTimers()
    render(
      createElement(QueueBar, {
        items: [
          {
            promptId: 'p1',
            author: 'Jamel',
            self: true,
            sendable: true,
            text: 'first line\nsecond line that stays intact'
          }
        ],
        onEdit: vi.fn(),
        onRemove: vi.fn(),
        onSend: vi.fn(),
        onMove: vi.fn()
      })
    )

    fireEvent.click(screen.getByText('1 message queued'))
    fireEvent.mouseEnter(screen.getByText('first line second line that stays intact'))
    await vi.advanceTimersByTimeAsync(300)

    const full = () =>
      screen.queryByText((_, element) => element?.textContent === 'first line\nsecond line that stays intact')
    expect(full()).toBeTruthy()
    fireEvent.pointerDown(document.querySelector('[data-reorder] .text-fg-secondary')!, {
      button: 0,
      clientX: 80,
      clientY: 80
    })
    expect(full()).toBeNull()
    fireEvent.pointerUp(window)
    vi.useRealTimers()
  })
})
