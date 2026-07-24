// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RepoControls from '../src/renderer/src/components/RepoControls'
import type { RepoStatus } from '../src/shared/repository'

const ready: RepoStatus = {
  available: true,
  remote: true,
  branch: 'main',
  changed: 2,
  ahead: 0,
  behind: 0
}

Object.defineProperty(Element.prototype, 'getAnimations', {
  configurable: true,
  value: () => []
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('project sync controls', () => {
  it('pulls changes and shows the result without leaving the app', async () => {
    const pullRepo = vi.fn(async () => ({
      ok: true,
      updated: true,
      message: 'Pulled the latest changes.',
      status: { ...ready, changed: 0 }
    }))
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: {
        repoStatus: vi.fn(async () => ready),
        pullRepo,
        pushRepo: vi.fn()
      } as unknown as CrewBridge
    })

    render(<RepoControls />)
    const pull = screen.getByLabelText('Pull changes') as HTMLButtonElement
    await waitFor(() => expect(pull.disabled).toBe(false))
    fireEvent.click(screen.getByLabelText('Pull changes'))

    await waitFor(() => expect(pullRepo).toHaveBeenCalledTimes(1))
    expect(screen.getAllByText('Pulled the latest changes.').length).toBeGreaterThan(0)
  })

  it('keeps pull and push unavailable when there is no remote', async () => {
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: {
        repoStatus: vi.fn(async () => ({ ...ready, remote: false })),
        pullRepo: vi.fn(),
        pushRepo: vi.fn()
      } as unknown as CrewBridge
    })

    render(<RepoControls />)

    await waitFor(() => expect((screen.getByLabelText('Pull changes') as HTMLButtonElement).disabled).toBe(true))
    expect((screen.getByLabelText('Push changes') as HTMLButtonElement).disabled).toBe(true)
  })
})
