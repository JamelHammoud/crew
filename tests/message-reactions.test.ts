// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MessageReactions from '../src/renderer/src/components/MessageReactions'
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
