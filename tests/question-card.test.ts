// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QuestionCard from '../src/renderer/src/components/work/QuestionCard'
import type { TicketQuestion } from '../src/shared/tickets'

const question = (over: Partial<TicketQuestion> = {}): TicketQuestion => ({
  id: 'ask1',
  ask: 'Key the cache on the commit or on the path?',
  assumed: 'the commit',
  options: ['the commit', 'the path'],
  ticket: 'Segment the chat log',
  since: 0,
  ...over
})

const card = (over: Partial<TicketQuestion>, onAnswer: (answer: string) => void) =>
  render(createElement(QuestionCard, { question: question(over), onAnswer }))

afterEach(cleanup)

describe('answering a question the agent raised', () => {
  it('takes one of the options in one press', () => {
    const answered = vi.fn()
    card({}, answered)
    fireEvent.click(screen.getByText('the path'))
    expect(answered).toHaveBeenCalledWith('the path')
  })

  it('takes an answer of your own beside them', () => {
    const answered = vi.fn()
    card({}, answered)
    const field = screen.getByPlaceholderText('Answer') as HTMLInputElement

    expect(screen.getByText('the commit')).toBeTruthy()
    fireEvent.change(field, { target: { value: 'on the branch' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(answered).toHaveBeenCalledWith('on the branch')
    expect(field.value).toBe('')
  })

  it('is still a field when the agent offered nothing to pick', () => {
    const answered = vi.fn()
    card({ options: [] }, answered)
    const field = screen.getByPlaceholderText('Answer')
    fireEvent.change(field, { target: { value: 'on the path' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(answered).toHaveBeenCalledWith('on the path')
  })

  it('says nothing on an empty answer', () => {
    const answered = vi.fn()
    card({}, answered)
    fireEvent.keyDown(screen.getByPlaceholderText('Answer'), { key: 'Enter' })
    expect(answered).not.toHaveBeenCalled()
  })

  it('says what it is working on and what answering late costs', () => {
    card({ since: 3 }, vi.fn())
    expect(screen.getByText('Working on the commit')).toBeTruthy()
    expect(screen.getByText('3 files changed since')).toBeTruthy()
  })
})
