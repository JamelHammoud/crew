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
const { useReviewed } = await import('../src/renderer/src/state/reviewed')
const ReviewView = (await import('../src/renderer/src/components/review/ReviewView')).default

const change = (path: string, staged: boolean, diff: string, over: Partial<RepoChange> = {}): RepoChange => ({
  path,
  kind: 'modified',
  staged,
  added: 1,
  removed: 1,
  diff,
  binary: false,
  truncated: false,
  ...over
})

const work = (over: Partial<RepoWork> = {}): RepoWork => ({
  status: { available: true, remote: true, branch: 'main', changed: 2, ahead: 1, behind: 0, stashes: 0 },
  changes: [],
  stashes: [],
  ...over
})

// A row of a diff is one line of the file however many spans the word picking
// broke it into, so it is read off the row rather than off a span.
const line = (text: string): Element | undefined =>
  [...document.querySelectorAll('.whitespace-pre')].find(el => el.textContent === text)

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
  useReviewed.setState({ read: {} })
  globalThis.localStorage?.clear()
})

afterEach(cleanup)

describe('the review tab', () => {
  // A file staged and then edited again is two different diffs, so it stands in
  // both lists rather than in one of them under a name that only half fits.
  it('keeps what is going in apart from what is not', async () => {
    bridge(
      work({
        changes: [
          change('src/app.ts', true, '@@ -1 +1 @@\n-old\n+staged'),
          change('src/app.ts', false, '@@ -1 +1 @@\n-staged\n+loose')
        ]
      })
    )

    render(createElement(ReviewView))

    expect(await screen.findByText('Going in')).not.toBeNull()
    expect(screen.getByText('Changed')).not.toBeNull()
    expect(screen.getAllByText('app.ts')).toHaveLength(2)
  })

  // Reading a change is reading several files, so opening one never puts away
  // the one already open.
  it('holds several files open at once', async () => {
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

    fireEvent.click(rows[1]!)
    await waitFor(() => expect(screen.getByText('loose')).not.toBeNull())
    // Once in the file it was added to and once in the file it was taken out
    // of, which is both diffs standing open together.
    expect(screen.getAllByText('staged')).toHaveLength(2)
  })

  // A line with nothing around it cannot be judged. Git already sends three
  // lines either side of what moved and the reading is where they are worth
  // keeping.
  it('draws a change in the lines around it', async () => {
    bridge(
      work({
        changes: [
          change('src/app.ts', false, '@@ -1,3 +1,3 @@\n const before = 1\n-const gone = 2\n+const made = 2\n const after = 3')
        ]
      })
    )

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('app.ts'))

    // The word that moved is picked out inside the line, so a changed line is
    // several spans and only the whole row reads as the line.
    await waitFor(() => expect(line('const made = 2')).not.toBeUndefined())
    expect(line('const gone = 2')).not.toBeUndefined()
    expect(line('const before = 1')).not.toBeUndefined()
    expect(line('const after = 3')).not.toBeUndefined()
  })

  // Every line carries where it really sits, so two stretches four hundred
  // lines apart never read as neighbours.
  it('numbers the lines from the file rather than from the diff', async () => {
    bridge(
      work({
        changes: [change('src/app.ts', false, '@@ -40,3 +40,3 @@\n one\n-two\n+three\n four')]
      })
    )

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('app.ts'))

    await waitFor(() => expect(line('three')).not.toBeUndefined())
    expect(screen.getByText('40')).not.toBeNull()
    expect(screen.getByText('42')).not.toBeNull()
  })

  it('stages and unstages the file the button stands on', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Put it in'))

    await waitFor(() => expect(sent).toEqual([{ do: 'stage', paths: ['src/app.ts'] }]))
  })

  // The commit is a card of its own now, so nothing about it stands at the top
  // of the panel for the whole of the time there is nothing to save.
  it('keeps the message off the panel until there is something to commit', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))

    expect(await screen.findByText('app.ts')).not.toBeNull()
    expect(screen.queryByPlaceholderText('What changed')).toBeNull()
    expect(screen.queryByText('Commit 1 file')).toBeNull()
  })

  it('will not commit without a message', async () => {
    bridge(work({ changes: [change('src/app.ts', true, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('Commit 1 file'))

    const button = (await screen.findByText('Commit')).closest('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('What changed'), { target: { value: 'A change' } })
    await waitFor(() => expect(button.disabled).toBe(false))

    fireEvent.click(button)
    await waitFor(() => expect(sent).toEqual([{ do: 'commit', message: 'A change' }]))
  })

  // Which files you have already been through is the one question nobody can
  // answer halfway through a review, and it is yours rather than the crew's.
  it('remembers what you have read and says how much is left', async () => {
    bridge(
      work({
        changes: [
          change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+b'),
          change('src/two.ts', false, '@@ -1 +1 @@\n-a\n+b')
        ]
      })
    )

    render(createElement(ReviewView))
    const marks = await screen.findAllByLabelText('Mark as read')
    fireEvent.click(marks[0]!)

    expect(await screen.findByText('1 to read')).not.toBeNull()
    expect(screen.getByLabelText('Read it again')).not.toBeNull()
  })

  // What was read is that version of it. A file an agent has written to again
  // comes back unread, or the mark is a promise the screen cannot keep.
  it('brings a file back once it has changed again', async () => {
    bridge(work({ changes: [change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    const { unmount } = render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Mark as read'))
    await screen.findByLabelText('Read it again')
    unmount()

    bridge(work({ changes: [change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+c')] }))
    render(createElement(ReviewView))

    expect(await screen.findByLabelText('Mark as read')).not.toBeNull()
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

  // Restoring a file takes it back to what the index holds, so discarding a
  // staged change would only throw half of it away. It is unstaged first.
  it('offers discard on what is not staged and nowhere else', async () => {
    bridge(
      work({
        changes: [
          change('src/app.ts', true, '@@ -1 +1 @@\n-a\n+b'),
          change('src/other.ts', false, '@@ -1 +1 @@\n-a\n+b')
        ]
      })
    )

    render(createElement(ReviewView))

    fireEvent.click(await screen.findByLabelText('More for app.ts'))
    expect(screen.queryByText('Discard')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })

    fireEvent.click(screen.getByLabelText('More for other.ts'))
    expect(await screen.findByText('Discard')).not.toBeNull()
  })

  it('says what has been put aside and puts it back', async () => {
    bridge(work({ stashes: [{ ref: 'stash@{0}', message: 'Half a feature', branch: 'main' }] }))

    render(createElement(ReviewView))
    expect(await screen.findByText('Half a feature')).not.toBeNull()

    fireEvent.click(screen.getByLabelText('More for Half a feature'))
    fireEvent.click(await screen.findByText('Put it back'))

    await waitFor(() => expect(sent).toEqual([{ do: 'apply', ref: 'stash@{0}' }]))
  })

  // Staging three files is three presses in a breath and the host takes one at
  // a time, so a press that lands mid-action waits rather than being lost.
  it('queues presses instead of dropping them', async () => {
    bridge(
      work({
        changes: [
          change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+b'),
          change('src/two.ts', false, '@@ -1 +1 @@\n-a\n+b')
        ]
      })
    )

    render(createElement(ReviewView))
    const buttons = await screen.findAllByLabelText('Put it in')
    fireEvent.click(buttons[0]!)
    fireEvent.click(buttons[1]!)

    await waitFor(() =>
      expect(sent).toEqual([
        { do: 'stage', paths: ['src/one.ts'] },
        { do: 'stage', paths: ['src/two.ts'] }
      ])
    )
  })

  it('says so rather than standing empty when the project has no git', async () => {
    bridge(work({ status: { ...work().status, available: false } }))

    render(createElement(ReviewView))

    expect(await screen.findByText('This project is not kept in git.')).not.toBeNull()
  })

  it('stands on one tab however many times it is opened', () => {
    act(() => useBrowser.getState().openReview())
    act(() => useBrowser.getState().openReview())

    expect(useBrowser.getState().tabs.filter(tab => tab.kind === 'review')).toHaveLength(1)
    expect(useBrowser.getState().open).toBe(true)
  })
})
