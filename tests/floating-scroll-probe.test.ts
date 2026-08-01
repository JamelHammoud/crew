// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement as h } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HoverCard from '../src/renderer/src/components/HoverCard'
import Tooltip from '../src/renderer/src/components/Tooltip'
import { hoverCardIn } from '../src/renderer/src/components/HoverCard'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const wait = () =>
  act(() => {
    vi.advanceTimersByTime(400)
  })

const floating = () => document.querySelectorAll('.glass.fixed')

const stage = (which: 'tooltip' | 'card') => {
  const floater =
    which === 'tooltip'
      ? h(Tooltip, { label: 'Show panel', children: h('button', null, 'panel') })
      : h(HoverCard, { content: 'the whole of what was asked', children: h('button', null, 'ask') })
  return render(
    h(
      'div',
      null,
      h('div', { 'data-testid': 'thread' }, 'a thread that scrolls itself'),
      h('div', { 'data-testid': 'bar' }, floater)
    )
  )
}

describe('a tooltip while another part of the app scrolls', () => {
  it('stands while the thread scrolls under it', () => {
    const view = stage('tooltip')
    fireEvent.mouseEnter(view.getByText('panel').parentElement as HTMLElement)
    wait()
    expect(floating()).toHaveLength(1)

    fireEvent.scroll(view.getByTestId('thread'))

    expect(floating()).toHaveLength(1)
  })

  it('goes when the box it hangs off is the one that moved', () => {
    const view = stage('tooltip')
    fireEvent.mouseEnter(view.getByText('panel').parentElement as HTMLElement)
    wait()
    expect(floating()).toHaveLength(1)

    fireEvent.scroll(view.getByTestId('bar'))

    expect(floating()).toHaveLength(0)
  })
})

describe('a hover card while another part of the app scrolls', () => {
  it('stands while the thread scrolls under it', () => {
    const view = stage('card')
    fireEvent.mouseEnter(view.getByText('ask').parentElement as HTMLElement)
    wait()
    expect(floating()).toHaveLength(1)

    fireEvent.scroll(view.getByTestId('thread'))

    expect(floating()).toHaveLength(1)
  })

  it('goes when the box it hangs off is the one that moved', () => {
    const view = stage('card')
    fireEvent.mouseEnter(view.getByText('ask').parentElement as HTMLElement)
    wait()
    expect(floating()).toHaveLength(1)

    fireEvent.scroll(view.getByTestId('bar'))

    expect(floating()).toHaveLength(0)
  })

  it('only holds a scroller still for a card standing inside it', () => {
    const view = stage('card')
    fireEvent.mouseEnter(view.getByText('ask').parentElement as HTMLElement)
    wait()

    expect(hoverCardIn(view.getByTestId('bar'))).toBe(true)
    expect(hoverCardIn(view.getByTestId('thread'))).toBe(false)
  })
})
