// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RepoChange, RepoCommand, RepoWork } from '../src/shared/repository'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []

const { useBrowser } = await import('../src/renderer/src/state/browser')
const ReviewView = (await import('../src/renderer/src/components/review/ReviewView')).default

const change = (path: string, staged: boolean, diff: string): RepoChange => ({
  path,
  kind: 'modified',
  staged,
  added: 1,
  removed: 1,
  diff,
  binary: false,
  truncated: false
})

const work = (over: Partial<RepoWork> = {}): RepoWork => ({
  status: { available: true, remote: true, branch: 'main', changed: 2, ahead: 1, behind: 0, stashes: 0 },
  changes: [],
  stashes: [],
  ...over
})

let sent: RepoCommand[] = []

function bridge(next: RepoWork) {
  sent = []
  const repoWork = vi.fn(async () => next)
  const runRepo = vi.fn(async (command: RepoCommand) => {
    sent.push(command)
    return { ok: true, updated: true, message: 'Done', status: next.status }
  })
  window.crew = { repoWork, runRepo } as unknown as CrewBridge
  return { repoWork, runRepo }
}

beforeEach(() => {
  vi.useRealTimers()
  useBrowser.setState({ open: false, tabs: [], activeTabId: null })
})

afterEach(cleanup)

describe('the review tab', () => {
  // A file staged and then edited again is two different diffs, so it stands in
  // both lists rather than in one of them under a name that only half fits.
  it('keeps what is staged apart from what is not', async () => {
    bridge(
      work({
        changes: [
          change('src/app.ts', true, '@@ -1 +1 @@\n-old\n+staged'),
          change('src/app.ts', false, '@@ -1 +1 @@\n-staged\n+loose')
        ]
      })
    )

    render(createElement(ReviewView))

    expect(await screen.findByText('Staged')).not.toBeNull()
    expect(screen.getByText('Changed')).not.toBeNull()
    expect(screen.getAllByText('app.ts')).toHaveLength(2)
  })

  it('opens one file at a time onto its own diff', async () => {
    bridge(
      work({
        changes: [
          change('src/app.ts', true, '@@ -1 +1 @@\n-old\n+staged'),
          change('src/app.ts', false, '@@ -1 +1 @@\n-staged\n+loose')
        ]
      })
    )

    render(createElement(ReviewView))
    const rows = await screen.findAllByText('app.ts')

    fireEvent.click(rows[0]!)
    await waitFor(() => expect(screen.getByText('staged')).not.toBeNull())
    expect(screen.queryByText('loose')).toBeNull()

    fireEvent.click(rows[1]!)
    await waitFor(() => expect(screen.getByText('loose')).not.toBeNull())
  })

  it('stages and unstages the file the button stands on', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Stage'))

    await waitFor(() => expect(sent).toEqual([{ do: 'stage', paths: ['src/app.ts'] }]))
  })

  it('will not commit without a message or without anything staged', async () => {
    bridge(work({ changes: [change('src/app.ts', true, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    const button = (await screen.findByText('Commit 1 file')).closest('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('What changed'), { target: { value: 'A change' } })
    await waitFor(() => expect(button.disabled).toBe(false))

    fireEvent.click(button)
    await waitFor(() => expect(sent).toEqual([{ do: 'commit', message: 'A change' }]))
  })

  // Discarding is the one thing here nobody can undo, so it is asked about
  // before it happens rather than after.
  it('asks before it throws edits away', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('Discard all'))

    expect(screen.getByText('Discard these edits')).not.toBeNull()
    expect(sent).toEqual([])

    fireEvent.click(screen.getByText('Keep them'))
    await waitFor(() => expect(screen.queryByText('Discard these edits')).toBeNull())
    expect(sent).toEqual([])
  })

  it('discards once it has been told to', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('Discard all'))
    fireEvent.click(screen.getByText('Discard'))

    await waitFor(() => expect(sent).toEqual([{ do: 'discard', paths: ['src/app.ts'] }]))
  })

  it('says what has been put aside and puts it back', async () => {
    bridge(work({ stashes: [{ ref: 'stash@{0}', message: 'Half a feature', branch: 'main' }] }))

    render(createElement(ReviewView))
    expect(await screen.findByText('Half a feature')).not.toBeNull()

    fireEvent.click(screen.getByLabelText('More'))
    fireEvent.click(await screen.findByText('Put it back'))

    await waitFor(() => expect(sent).toEqual([{ do: 'apply', ref: 'stash@{0}' }]))
  })

  it('says so rather than standing empty when the project has no git', async () => {
    bridge(work({ status: { ...work().status, available: false } }))

    render(createElement(ReviewView))

    expect(await screen.findByText('This project is not kept in git, so there is nothing to review.')).not.toBeNull()
  })

  it('stands on one tab however many times it is opened', () => {
    act(() => useBrowser.getState().openReview())
    act(() => useBrowser.getState().openReview())

    expect(useBrowser.getState().tabs.filter(tab => tab.kind === 'review')).toHaveLength(1)
    expect(useBrowser.getState().open).toBe(true)
  })
})
