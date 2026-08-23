// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QueueBar from '../src/renderer/src/components/QueueBar'
import { useCrew } from '../src/renderer/src/state/store'

describe('queued message cards', () => {
  afterEach(cleanup)

  it('keeps the message shape and exposes editing and ordering', () => {
    useCrew.setState({ httpBase: 'http://127.0.0.1:1234' })
    const edit = vi.fn()
    const move = vi.fn()
    render(
      <QueueBar
        items={[
          {
            promptId: 'p1',
            author: 'Jamel',
            self: true,
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
          { promptId: 'p2', author: 'Jamel', self: true, text: 'after that' }
        ]}
        onEdit={edit}
        onRemove={vi.fn()}
        onMove={move}
      />
    )

    fireEvent.click(screen.getByText('2 messages queued'))
    expect(screen.getByText('first line\nsecond line')).toBeTruthy()
    expect(screen.getByText('Replying to Ali')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'room.png' })).toBeTruthy()

    fireEvent.click(screen.getAllByLabelText('Edit queued message')[0])
    expect(edit).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getAllByLabelText('Move queued message later')[0])
    expect(move).toHaveBeenCalledWith('p1', 1)
    fireEvent.click(screen.getAllByLabelText('Move queued message earlier')[1])
    expect(move).toHaveBeenCalledWith('p2', 0)
  })
})
