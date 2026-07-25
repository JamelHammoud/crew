// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RepoControls from '../src/renderer/src/components/RepoControls'
import TopBar from '../src/renderer/src/components/TopBar'
import type { RepoStatus } from '../src/shared/repository'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

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
  vi.unstubAllEnvs()
})

const topBar = () =>
  createElement(TopBar, { tab: 'chat' as const, onTab: () => {}, tasksOpen: false, onToggleTasks: () => {} })

describe('project sync controls', () => {
  it('opens the local diff before pushing it', async () => {
    const status = { ...ready, changed: 1 }
    const repoChanges = vi.fn(async () => [
      {
        path: 'src/app.ts',
        kind: 'modified' as const,
        added: 1,
        removed: 1,
        diff: '@@ -1 +1 @@\n-old\n+new',
        binary: false,
        truncated: false
      }
    ])
    const pushRepo = vi.fn(async () => ({
      ok: true,
      updated: true,
      message: 'Pushed the latest changes.',
      status: { ...status, changed: 0 }
    }))
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: {
        repoStatus: vi.fn(async () => status),
        repoChanges,
        pullRepo: vi.fn(),
        pushRepo
      } as unknown as CrewBridge
    })

    render(createElement(RepoControls))
    const review = await screen.findByLabelText('Review 1 change')
    fireEvent.click(review)

    await waitFor(() => expect(repoChanges).toHaveBeenCalledTimes(1))
    expect(screen.getByText('src/app.ts')).toBeTruthy()
    expect(screen.getByText('+new')).toBeTruthy()

    fireEvent.click(screen.getByText('Push changes'))
    await waitFor(() => expect(pushRepo).toHaveBeenCalledTimes(1))
  })

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

    render(createElement(RepoControls))
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

    render(createElement(RepoControls))

    await waitFor(() => expect((screen.getByLabelText('Pull changes') as HTMLButtonElement).disabled).toBe(true))
    expect((screen.getByLabelText('Push changes') as HTMLButtonElement).disabled).toBe(true)
  })

  it('stays out of the top bar, dev mode or not', async () => {
    const repoStatus = vi.fn(async () => ready)
    Object.defineProperty(window, 'crew', {
      configurable: true,
      value: { repoStatus, pullRepo: vi.fn(), pushRepo: vi.fn() } as unknown as CrewBridge
    })

    for (const dev of [true, false]) {
      vi.stubEnv('DEV', dev)
      render(topBar())
      expect(screen.queryByLabelText('Pull changes')).toBeNull()
      expect(screen.queryByLabelText('Push changes')).toBeNull()
      expect(screen.queryByRole('group', { name: 'Project sync' })).toBeNull()
      cleanup()
    }
  })
})
