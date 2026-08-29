import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sticky } from '../src/shared/stickies'

const calls = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  focus: vi.fn()
}))

vi.mock('../src/renderer/src/state/stickies', () => ({
  createSticky: calls.create,
  updateSticky: calls.update
}))

vi.mock('../src/renderer/src/components/DocEditor', async () => {
  const React = await import('react')
  const DocEditor = React.forwardRef<
    { focusStart: () => void; flush: () => void; discard: () => void },
    { onChange: (body: string) => void }
  >(({ onChange }, ref) => {
    React.useImperativeHandle(ref, () => ({
      focusStart: calls.focus,
      flush: vi.fn(),
      discard: vi.fn()
    }))
    return React.createElement(
      'div',
      null,
      React.createElement('button', { type: 'button', onClick: () => onChange('') }, 'Initialize body'),
      React.createElement('button', { type: 'button', onClick: () => onChange('First line') }, 'Write body')
    )
  })
  return { default: DocEditor }
})

const { default: StickyEditor, stickyEditorBackground } = await import('../src/renderer/src/components/StickyEditor')

const draft = (): Sticky => ({
  id: 'draft:one',
  body: '',
  color: 'yellow',
  pinned: false,
  createdAt: 1,
  updatedAt: 1
})

beforeEach(() => {
  calls.create.mockReset()
  calls.update.mockReset()
  calls.focus.mockReset()
  calls.create.mockResolvedValue({ ...draft(), id: 'saved' })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('a new sticky editor', () => {
  it('focuses the body without creating a saved sticky', async () => {
    render(createElement(StickyEditor, { sticky: draft(), draft: true, fresh: true }))

    await waitFor(() => expect(calls.focus).toHaveBeenCalledTimes(1))
    expect(calls.create).not.toHaveBeenCalled()
  })

  it('creates the sticky with the first body edit intact', async () => {
    render(createElement(StickyEditor, { sticky: draft(), draft: true, fresh: true }))

    fireEvent.click(screen.getByRole('button', { name: 'Write body' }))

    await waitFor(() =>
      expect(calls.create).toHaveBeenCalledWith({
        title: undefined,
        body: 'First line',
        color: 'yellow',
        pinned: false
      })
    )
  })

  it('does not save an empty editor initialization', () => {
    render(createElement(StickyEditor, { sticky: draft(), draft: true, fresh: true }))

    fireEvent.click(screen.getByRole('button', { name: 'Initialize body' }))

    expect(calls.create).not.toHaveBeenCalled()
  })

  it('tints the editor surface with the chosen sticky color', () => {
    expect(stickyEditorBackground('blue')).toContain('#78aee8')
    expect(stickyEditorBackground('purple')).toContain('#d394df')
  })
})

describe('a saved sticky editor', () => {
  it('removes the title when the field is cleared', async () => {
    render(createElement(StickyEditor, { sticky: { ...draft(), id: 'saved', title: 'Shopping' } }))

    const title = screen.getByRole('textbox', { name: 'Sticky title' })
    fireEvent.change(title, { target: { value: '' } })
    fireEvent.blur(title)

    await waitFor(() => expect(calls.update).toHaveBeenCalledWith('saved', { title: '' }))
  })
})
