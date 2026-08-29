// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, forwardRef, useImperativeHandle, type ForwardedRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sticky } from '../src/shared/stickies'

const focusStart = vi.hoisted(() => vi.fn())

vi.mock('../src/renderer/src/components/DocEditor', () => ({
  default: forwardRef(function FakeDocEditor(
    { onChange }: { onChange: (body: string) => void },
    ref: ForwardedRef<{ focusStart: () => void; flush: () => void; discard: () => void }>
  ) {
    useImperativeHandle(ref, () => ({ focusStart, flush: () => {}, discard: () => {} }))
    return createElement('button', { onClick: () => onChange('# First line') }, 'Write body')
  })
}))

const { default: StickyEditor, stickyEditorBackground } = await import(
  '../src/renderer/src/components/StickyEditor'
)
const { stickyColorValue, stickyLabel, stickyPreview } = await import(
  '../src/renderer/src/components/StickySidebar'
)

const draft: Sticky = {
  id: 'draft:one',
  body: '',
  color: 'yellow',
  pinned: false,
  createdAt: 1,
  updatedAt: 1
}

const saved: Sticky = { ...draft, id: 'sticky-one', body: '# First line', updatedAt: 2 }
const createSticky = vi.fn(async () => saved)
const updateSticky = vi.fn(async () => saved)

beforeEach(() => {
  focusStart.mockClear()
  createSticky.mockClear()
  updateSticky.mockClear()
  window.crew = { createSticky, updateSticky } as unknown as CrewBridge
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('stickies window', () => {
  it('focuses the body and includes a body-first edit in lazy creation', async () => {
    render(createElement(StickyEditor, { sticky: draft, draft: true, fresh: true }))

    expect(focusStart).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Write body'))

    await vi.waitFor(() =>
      expect(createSticky).toHaveBeenCalledWith({
        title: undefined,
        body: '# First line',
        color: 'yellow',
        pinned: false
      })
    )
    expect(updateSticky).not.toHaveBeenCalled()
  })

  it('uses the first written line when the optional title is empty', () => {
    const sticky = { ...saved, title: undefined, body: '# First line\n\nSecond line' }

    expect(stickyLabel(sticky)).toBe('First line')
    expect(stickyPreview(sticky)).toBe('Second line')
  })

  it('keeps the shared color order and mixes the selected color into the page', () => {
    expect(['yellow', 'pink', 'blue', 'green', 'purple'].map(stickyColorValue)).toEqual([
      '#e9c46a',
      '#ef8f8f',
      '#78aee8',
      '#6fc7ad',
      '#d394df'
    ])
    expect(stickyEditorBackground('blue')).toBe(
      'color-mix(in srgb, var(--color-ink-900) 94%, #78aee8)'
    )
  })
})
