// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MessageReactions from '../src/renderer/src/components/MessageReactions'
import { reactionName, reactorLine } from '../src/renderer/src/components/ReactionTip'
import { reactionGroups } from '../src/renderer/src/components/reactionGroups'
import { buildThread } from '../src/renderer/src/components/thread'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import { agentStepReactionTarget } from '../src/shared/reactions'

const defaultReactToMessage = useCrew.getState().reactToMessage

afterEach(() => {
  cleanup()
  useCrew.setState({ reactToMessage: defaultReactToMessage })
})

describe('message reaction controls', () => {
  it('sends a quick reaction and lets someone remove their reaction from the count', () => {
    const reactToMessage = vi.fn()
    useCrew.setState({ reactToMessage })
    render(
      createElement(
        'div',
        { className: 'group/message' },
        createElement(MessageReactions, {
          targetId: 'message:m1',
          reactions: [{ emoji: '❤️', count: 2, names: ['Ali', 'Jamel'], self: true }],
          deletable: false,
          onDelete: () => {}
        })
      )
    )

    fireEvent.click(screen.getByLabelText('React with 🎉'))
    expect(reactToMessage).toHaveBeenCalledWith('message:m1', '🎉')

    fireEvent.click(screen.getByLabelText('❤️, 2 reactions'))
    expect(reactToMessage).toHaveBeenCalledWith('message:m1', '❤️')
  })

  it('hides the quick react menu after a reaction and brings it back on the next hover', () => {
    useCrew.setState({ reactToMessage: vi.fn() })
    const { container } = render(
      createElement(
        'div',
        { className: 'group/message', 'data-message': 'message:m1' },
        createElement(MessageReactions, {
          targetId: 'message:m1',
          reactions: [],
          deletable: false,
          onDelete: () => {}
        })
      )
    )

    const message = container.firstElementChild as HTMLElement
    const menu = screen.getByLabelText('React with 🎉').parentElement as HTMLElement
    expect(menu.className).toContain('group-hover/message:opacity-100')

    fireEvent.click(screen.getByLabelText('React with 🎉'), { detail: 1 })
    expect(menu.className).not.toContain('group-hover/message:opacity-100')

    fireEvent.mouseLeave(message)
    expect(menu.className).not.toContain('group-hover/message:opacity-100')

    fireEvent.mouseEnter(message)
    expect(menu.className).toContain('group-hover/message:opacity-100')
  })

  it('never pins the quick react menu open on the button that was clicked', () => {
    useCrew.setState({ reactToMessage: vi.fn() })
    render(
      createElement(
        'div',
        { className: 'group/message', 'data-message': 'message:m1' },
        createElement(MessageReactions, {
          targetId: 'message:m1',
          reactions: [],
          deletable: false,
          onDelete: () => {}
        })
      )
    )

    const menu = screen.getByLabelText('React with 🎉').parentElement as HTMLElement
    expect(menu.className).not.toContain('focus-within:opacity-100')
    expect(menu.className).toContain('has-[:focus-visible]:opacity-100')
  })

  it('keeps the quick react menu up for a reaction sent from the keyboard', () => {
    useCrew.setState({ reactToMessage: vi.fn() })
    render(
      createElement(
        'div',
        { className: 'group/message', 'data-message': 'message:m1' },
        createElement(MessageReactions, {
          targetId: 'message:m1',
          reactions: [],
          deletable: false,
          onDelete: () => {}
        })
      )
    )

    const menu = screen.getByLabelText('React with 🎉').parentElement as HTMLElement
    fireEvent.click(screen.getByLabelText('React with 🎉'), { detail: 0 })
    expect(menu.className).toContain('has-[:focus-visible]:opacity-100')
  })

  it('groups active reactions and removes toggled reactions', () => {
    const events: SessionEvent[] = [
      {
        id: 'r1',
        ts: 1,
        kind: 'message.reaction',
        targetId: 'message:m1',
        targetAuthorId: 'ali',
        targetAuthorName: 'Ali',
        memberId: 'jamel',
        memberName: 'Jamel',
        emoji: '👍',
        active: true
      },
      {
        id: 'r2',
        ts: 2,
        kind: 'message.reaction',
        targetId: 'message:m1',
        targetAuthorId: 'ali',
        targetAuthorName: 'Ali',
        memberId: 'ali',
        memberName: 'Ali',
        emoji: '👍',
        active: true
      },
      {
        id: 'r3',
        ts: 3,
        kind: 'message.reaction',
        targetId: 'message:m1',
        targetAuthorId: 'ali',
        targetAuthorName: 'Ali',
        memberId: 'jamel',
        memberName: 'Jamel',
        emoji: '👍',
        active: false
      }
    ]

    expect(reactionGroups(events, 'ali').get('message:m1')).toEqual([
      { emoji: '👍', count: 1, names: ['Ali'], self: true }
    ])
  })

  it('names you first in a group you reacted to', () => {
    const reaction = (memberId: string, memberName: string, ts: number): SessionEvent => ({
      id: `r${ts}`,
      ts,
      kind: 'message.reaction',
      targetId: 'message:m1',
      targetAuthorId: 'ali',
      targetAuthorName: 'Ali',
      memberId,
      memberName,
      emoji: '🔥',
      active: true
    })

    expect(
      reactionGroups([reaction('ali', 'Ali', 1), reaction('jamel', 'Jamel', 2)], 'jamel').get('message:m1')
    ).toEqual([{ emoji: '🔥', count: 2, names: ['Jamel', 'Ali'], self: true }])
  })

  it('names the reaction and everyone who sent it, and counts off a crowd', () => {
    expect(reactorLine({ names: ['Ali'], self: false })).toBe('Ali')
    expect(reactorLine({ names: ['Jamel', 'Ali'], self: true })).toBe('You and Ali')
    expect(reactorLine({ names: ['Ali', 'Ben', 'Cat', 'Dee'], self: false })).toBe('Ali, Ben, Cat and Dee')
    expect(reactorLine({ names: ['Jamel', 'Ali', 'Ben', 'Cat', 'Dee'], self: true })).toBe(
      'You, Ali, Ben and 2 others'
    )
    expect(reactionName('🔥')).toBe(':fire:')
  })

  it('shows the reaction, its name and who reacted on hover', () => {
    vi.useFakeTimers()
    try {
      useCrew.setState({ reactToMessage: vi.fn() })
      render(
        createElement(
          'div',
          { className: 'group/message' },
          createElement(MessageReactions, {
            targetId: 'message:m1',
            reactions: [{ emoji: '🔥', count: 2, names: ['Jamel', 'Ali'], self: true }],
            deletable: false,
            onDelete: () => {}
          })
        )
      )

      fireEvent.mouseEnter(screen.getByLabelText('🔥, 2 reactions').parentElement as HTMLElement)
      act(() => vi.advanceTimersByTime(400))

      expect(screen.getByText('You and Ali')).toBeTruthy()
      expect(screen.getByText(/reacted with/).textContent).toBe('reacted with :fire:')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stands an add reaction button at the end of the row, and only once something is there', () => {
    useCrew.setState({ reactToMessage: vi.fn() })
    const { rerender } = render(
      createElement(
        'div',
        { className: 'group/message' },
        createElement(MessageReactions, {
          targetId: 'message:m1',
          reactions: [],
          deletable: false,
          onDelete: () => {}
        })
      )
    )
    expect(screen.queryByLabelText('Add reaction')).toBeNull()

    rerender(
      createElement(
        'div',
        { className: 'group/message' },
        createElement(MessageReactions, {
          targetId: 'message:m1',
          reactions: [{ emoji: '🔥', count: 1, names: ['Ali'], self: false }],
          deletable: false,
          onDelete: () => {}
        })
      )
    )

    const add = screen.getByLabelText('Add reaction')
    const row = add.closest('div') as HTMLElement
    expect(row.lastElementChild?.contains(add)).toBe(true)
    expect([...row.querySelectorAll('button')].at(-1)).toBe(add)
    expect(add.className).toContain('group-hover/message:opacity-100')
  })

  it('reacts from the row button and holds it up while its picker is open', () => {
    const reactToMessage = vi.fn()
    useCrew.setState({ reactToMessage })
    render(
      createElement(
        'div',
        { className: 'group/message' },
        createElement(MessageReactions, {
          targetId: 'message:m1',
          reactions: [{ emoji: '🔥', count: 1, names: ['Ali'], self: false }],
          deletable: false,
          onDelete: () => {}
        })
      )
    )

    const add = screen.getByLabelText('Add reaction')
    fireEvent.click(add)
    expect(add.className).toContain('opacity-100')
    expect(add.className).not.toContain('opacity-0')

    fireEvent.change(screen.getByPlaceholderText('Search emoji'), { target: { value: 'tada' } })
    fireEvent.click(screen.getByLabelText('React with :tada:'))

    expect(reactToMessage).toHaveBeenCalledWith('message:m1', '🎉')
    expect(screen.queryByPlaceholderText('Search emoji')).toBeNull()
  })

  it('keeps a reaction on the exact agent reply block it targets', () => {
    const events: SessionEvent[] = [
      {
        id: 'start',
        ts: 1,
        kind: 'agent.start',
        promptId: 'p1',
        agentId: 'agent-a',
        agentLabel: 'Agent A',
        promptText: 'go',
        byName: 'Ali',
        threadId: 't1'
      },
      {
        id: 'reaction',
        ts: 4,
        kind: 'message.reaction',
        targetId: agentStepReactionTarget('p1', 'second'),
        targetAuthorId: 'agent-a',
        targetAuthorName: 'Agent A',
        memberId: 'ali',
        memberName: 'Ali',
        emoji: '🎉',
        active: true,
        threadId: 't1'
      }
    ]
    const items = buildThread(
      events,
      {
        p1: [
          { id: 'first', ts: 2, kind: 'text', text: 'First block', status: 'done' },
          { id: 'second', ts: 3, kind: 'text', text: 'Second block', status: 'done' }
        ]
      },
      'ali'
    )

    expect(items.find(item => item.text === 'First block')?.reactions).toBeUndefined()
    expect(items.find(item => item.text === 'Second block')?.reactions).toEqual([
      { emoji: '🎉', count: 1, names: ['Ali'], self: true }
    ])
  })
})
