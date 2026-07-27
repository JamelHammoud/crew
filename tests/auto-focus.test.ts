// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { createElement, useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAutoFocus } from '../src/renderer/src/components/useAutoFocus'

function Field({ readyAfterMs }: { readyAfterMs: number | null }) {
  const ref = useAutoFocus<HTMLInputElement>()
  const [ready, setReady] = useState(readyAfterMs === 0)

  useEffect(() => {
    if (readyAfterMs === null || readyAfterMs === 0) return
    const timer = setTimeout(() => setReady(true), readyAfterMs)
    return () => clearTimeout(timer)
  }, [readyAfterMs])

  return createElement('input', { ref, disabled: !ready, placeholder: 'Search' })
}

const frames = (count: number) => act(() => void vi.advanceTimersByTime(count * 16))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('a field that asks for focus', () => {
  it('takes it on mount when it already can', () => {
    render(createElement(Field, { readyAfterMs: 0 }))

    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search'))
  })

  it('keeps asking until the field can take it', () => {
    vi.useFakeTimers()
    render(createElement(Field, { readyAfterMs: 32 }))
    const field = screen.getByPlaceholderText('Search')

    expect(document.activeElement).not.toBe(field)

    frames(4)

    expect(document.activeElement).toBe(field)
  })

  it('gives up rather than asking every frame forever', () => {
    vi.useFakeTimers()
    render(createElement(Field, { readyAfterMs: null }))
    const field = screen.getByPlaceholderText('Search') as HTMLInputElement

    frames(60)
    field.disabled = false
    frames(10)

    expect(document.activeElement).not.toBe(field)
  })
})
