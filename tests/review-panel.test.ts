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
const DiffLines = (await import('../src/renderer/src/components/DiffLines')).default
const { clampSplit, defaultSplit, DIFF_MIN, LIST_MIN } = await import('../src/renderer/src/components/review/split')

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
  branches: [{ name: 'main', current: true, remote: false }],
  ...over
})

// A row of a diff is one line of the file however many spans the word picking
// broke it into, so it is read off the row rather than off a span. A line being
// reviewed wraps and a line in a thread step does not, which is two classes for
// the one thing.
const line = (text: string): Element | undefined =>
  [...document.querySelectorAll('.whitespace-pre, .whitespace-pre-wrap')].find(el => el.textContent === text)

// The one press that confirms, rather than the heading over it saying the same
// words.
const button = (label: string): HTMLButtonElement => {
  const found = screen.getAllByText(label).find(el => el.closest('button'))
  return found?.closest('button') as HTMLButtonElement
}

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
  // both lists rather than in one of them under a name that only half fits. The
  // groups are named the way every git client names them.
  it('keeps the staged changes apart from the rest', async () => {
    bridge(
      work({
        changes: [
          change('src/app.ts', true, '@@ -1 +1 @@\n-old\n+staged'),
          change('src/app.ts', false, '@@ -1 +1 @@\n-staged\n+loose')
        ]
      })
    )

    render(createElement(ReviewView))

    expect(await screen.findByText('Staged Changes')).not.toBeNull()
    expect(screen.getByText('Changes')).not.toBeNull()
    expect(screen.getAllByText('app.ts')).toHaveLength(2)
  })

  // A conflict is neither staged nor unstaged until somebody has settled it, and
  // it is the one thing on this screen that has to be dealt with by hand, so it
  // stands in a group of its own at the head of the list.
  it('stands a conflict in its own group', async () => {
    bridge(
      work({
        changes: [
          change('src/clash.ts', false, '@@ -1 +1 @@\n-a\n+b', { kind: 'conflict' }),
          change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')
        ]
      })
    )

    render(createElement(ReviewView))

    expect(await screen.findByText('Merge Changes')).not.toBeNull()
    const groups = [...document.querySelectorAll('h3')].map(el => el.textContent)
    expect(groups).toEqual(['Merge Changes', 'Changes'])
  })

  // The letter every git client puts at the end of the row. A file git has never
  // been told about is an add that is not staged, since nothing can stage
  // itself, and that is the one kind the record does not name on its own.
  it('marks each row with the letter git would', async () => {
    bridge(
      work({
        changes: [
          change('src/new.ts', false, '@@ -0,0 +1 @@\n+a', { kind: 'added' }),
          change('src/gone.ts', false, '@@ -1 +0,0 @@\n-a', { kind: 'deleted' }),
          change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b'),
          change('src/kept.ts', true, '@@ -0,0 +1 @@\n+a', { kind: 'added' })
        ]
      })
    )

    render(createElement(ReviewView))

    expect(await screen.findByText('U')).not.toBeNull()
    expect(screen.getByText('D')).not.toBeNull()
    expect(screen.getByText('M')).not.toBeNull()
    expect(screen.getByText('A')).not.toBeNull()
  })

  // The list is never taken away, because the list is how you get to the next
  // file. One file is read at a time, under it, and picking another puts that
  // one in its place rather than stacking a second reading under the first.
  it('reads one file at a time under the list', async () => {
    bridge(
      work({
        changes: [
          change('src/app.ts', true, '@@ -1 +1 @@\n-old\n+staged'),
          change('src/other.ts', false, '@@ -1 +1 @@\n-was\n+loose')
        ]
      })
    )

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('app.ts'))
    await waitFor(() => expect(line('staged')).not.toBeUndefined())

    fireEvent.click(screen.getByText('other.ts'))
    await waitFor(() => expect(line('loose')).not.toBeUndefined())
    expect(line('staged')).toBeUndefined()

    // The row it is standing on says so, so the list and the pane can never
    // disagree about which file is being read.
    fireEvent.click(screen.getByLabelText('Close other.ts'))
    await waitFor(() => expect(line('loose')).toBeUndefined())
  })

  // Every client draws the list and the file beside each other and none of them
  // has a next-file key, because walking the list is what opens the next file.
  it('walks the list on the arrows and follows with the reading', async () => {
    bridge(
      work({
        changes: [
          change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+first'),
          change('src/two.ts', false, '@@ -1 +1 @@\n-a\n+second')
        ]
      })
    )

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('one.ts'))
    await waitFor(() => expect(line('first')).not.toBeUndefined())

    const list = document.querySelector('[tabindex="-1"]') as HTMLElement
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    await waitFor(() => expect(line('second')).not.toBeUndefined())

    fireEvent.keyDown(list, { key: 'ArrowUp' })
    await waitFor(() => expect(line('first')).not.toBeUndefined())
  })

  // Marking a file read and moving on is one press, because that is the whole
  // of what a review is made of and doing it in two presses is doing it twice.
  it('marks a file viewed and moves to the next one', async () => {
    bridge(
      work({
        changes: [
          change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+first'),
          change('src/two.ts', false, '@@ -1 +1 @@\n-a\n+second')
        ]
      })
    )

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('one.ts'))
    await waitFor(() => expect(line('first')).not.toBeUndefined())

    fireEvent.click(screen.getByText('Viewed'))

    await waitFor(() => expect(line('second')).not.toBeUndefined())
    expect(screen.getByLabelText('Mark one.ts as not viewed')).not.toBeNull()
  })

  // Staging a file moves it to another group, so the key it was opened under
  // stops answering. It is the same file and the same reading, so the pane
  // follows the path rather than going dark under somebody mid-sentence.
  it('keeps reading a file that has just been staged', async () => {
    let staged = false
    window.crew = {
      repoWork: async () => work({ changes: [change('src/app.ts', staged, '@@ -1 +1 @@\n-a\n+kept')] }),
      runRepo: async (command: RepoCommand) => {
        if (command.do === 'stage') staged = true
        return { ok: true, updated: true, message: 'Done', status: work().status }
      }
    } as unknown as CrewBridge

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByText('app.ts'))
    await waitFor(() => expect(line('kept')).not.toBeUndefined())

    fireEvent.click(screen.getByLabelText('Stage app.ts'))

    await waitFor(() => expect(screen.getByText('Staged Changes')).not.toBeNull())
    expect(line('kept')).not.toBeUndefined()
  })

  // A long group is a group somebody wants out of the way, the way it folds in
  // every other client.
  it('folds a group away', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    expect(await screen.findByText('app.ts')).not.toBeNull()

    fireEvent.click(screen.getByLabelText('Changes'))
    await waitFor(() => expect(screen.queryByText('app.ts')).toBeNull())

    fireEvent.click(screen.getByLabelText('Changes'))
    expect(await screen.findByText('app.ts')).not.toBeNull()
  })

  // A line with nothing around it cannot be judged. Git already sends three
  // lines either side of what moved and the reading is where they are worth
  // keeping.
  it('draws a change in the lines around it', async () => {
    bridge(
      work({
        changes: [
          change(
            'src/app.ts',
            false,
            '@@ -1,3 +1,3 @@\n const before = 1\n-const gone = 2\n+const made = 2\n const after = 3'
          )
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

  it('stages the file the button stands on', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Stage app.ts'))

    await waitFor(() => expect(sent).toEqual([{ do: 'stage', paths: ['src/app.ts'] }]))
  })

  it('stages the whole group from its heading', async () => {
    bridge(
      work({
        changes: [
          change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+b'),
          change('src/two.ts', false, '@@ -1 +1 @@\n-a\n+b')
        ]
      })
    )

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Stage all changes'))

    await waitFor(() => expect(sent).toEqual([{ do: 'stage', paths: ['src/one.ts', 'src/two.ts'] }]))
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

    const commit = (await screen.findByText('Commit')).closest('button') as HTMLButtonElement
    expect(commit.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('What changed'), { target: { value: 'A change' } })
    await waitFor(() => expect(commit.disabled).toBe(false))

    fireEvent.click(commit)
    await waitFor(() => expect(sent).toEqual([{ do: 'commit', message: 'A change' }]))
  })

  // Which files you have already been through is the one question nobody can
  // answer halfway through a review, and it is yours rather than the crew's.
  it('remembers what you have viewed and says how far through you are', async () => {
    bridge(
      work({
        changes: [
          change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+b'),
          change('src/two.ts', false, '@@ -1 +1 @@\n-a\n+b')
        ]
      })
    )

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Mark one.ts as viewed'))

    // How far through is a line rather than a sentence: said in words it costs
    // a row of the panel for the whole of a session.
    expect(await screen.findByLabelText('1 of 2 viewed')).not.toBeNull()
    expect(screen.getByLabelText('Mark one.ts as not viewed')).not.toBeNull()
  })

  // What was viewed is that version of it. A file an agent has written to again
  // comes back unviewed, or the mark is a promise the screen cannot keep.
  it('brings a file back once it has changed again', async () => {
    bridge(work({ changes: [change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    const { unmount } = render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Mark one.ts as viewed'))
    await screen.findByLabelText('Mark one.ts as not viewed')
    unmount()

    bridge(work({ changes: [change('src/one.ts', false, '@@ -1 +1 @@\n-a\n+c')] }))
    render(createElement(ReviewView))

    expect(await screen.findByLabelText('Mark one.ts as viewed')).not.toBeNull()
  })

  // Discarding is the one thing here nobody can undo, so it is asked about
  // before it happens rather than after.
  it('asks before it throws changes away', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Discard all changes'))

    expect(screen.getByText('The changes in 1 file go for good.')).not.toBeNull()
    expect(sent).toEqual([])

    fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.queryByText('The changes in 1 file go for good.')).toBeNull())
    expect(sent).toEqual([])
  })

  it('discards once it has been told to', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.click(await screen.findByLabelText('Discard all changes'))
    fireEvent.click(button('Discard changes'))

    await waitFor(() => expect(sent).toEqual([{ do: 'discard', paths: ['src/app.ts'] }]))
  })

  // Restoring a file takes it back to what the index holds, so discarding a
  // staged change would only throw half of it away. It is unstaged first.
  it('offers discard on what is not staged and nowhere else', async () => {
    bridge(work({ changes: [change('src/app.ts', true, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    await screen.findByText('app.ts')

    expect(screen.queryByLabelText('Discard changes in app.ts')).toBeNull()
    expect(screen.getByLabelText('Unstage app.ts')).not.toBeNull()
  })

  // Restoring a conflict would throw away both sides of it rather than one
  // edit, so the one way out of it is staging what has been settled.
  it('offers no discard on a conflict', async () => {
    bridge(work({ changes: [change('src/clash.ts', false, '@@ -1 +1 @@\n-a\n+b', { kind: 'conflict' })] }))

    render(createElement(ReviewView))
    await screen.findByText('clash.ts')

    expect(screen.queryByLabelText('Discard changes in clash.ts')).toBeNull()
    expect(screen.getByLabelText('Stage clash.ts')).not.toBeNull()

    fireEvent.contextMenu(screen.getByText('clash.ts'))
    expect(await screen.findByText('Stage changes')).not.toBeNull()
    expect(screen.queryByText('Discard changes')).toBeNull()
  })

  // The right click is where the rest of what a file can do lives, the way it
  // does in Files and the way it does in every client this is meant to feel
  // like.
  it('opens the menu for a file on a right click', async () => {
    bridge(work({ changes: [change('src/app.ts', false, '@@ -1 +1 @@\n-a\n+b')] }))

    render(createElement(ReviewView))
    fireEvent.contextMenu(await screen.findByText('app.ts'))

    // Opening the changes is what pressing the row does, so the menu holds the
    // rest of it rather than a second way to do the same thing.
    expect(await screen.findByText('Open file')).not.toBeNull()
    expect(screen.getByText('Copy path')).not.toBeNull()
    expect(screen.getByText('Stage changes')).not.toBeNull()
    expect(screen.queryByText('Open changes')).toBeNull()
  })

  it('says what is stashed and puts it back', async () => {
    bridge(work({ stashes: [{ ref: 'stash@{0}', message: 'Half a feature', branch: 'main' }] }))

    render(createElement(ReviewView))
    expect(await screen.findByText('Half a feature')).not.toBeNull()
    expect(screen.getByText('Stashes')).not.toBeNull()

    fireEvent.click(screen.getByLabelText('More for Half a feature'))
    fireEvent.click(await screen.findByText('Apply stash'))

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
    fireEvent.click(await screen.findByLabelText('Stage one.ts'))
    fireEvent.click(screen.getByLabelText('Stage two.ts'))

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

// A line running off the right of a 480 column is the line being judged, so the
// reading wraps. A glance at what an agent did is read past rather than read,
// and it scrolls the way it always has: this is the boundary between the two
// and the one way the reading could quietly change every diff in every thread.
describe('a line too long for the column', () => {
  const rows = [{ text: 'const x = 1', line: 1, at: 1, changed: false, inner: [] }]

  it('wraps where it is being read and nowhere else', () => {
    const { container, unmount } = render(createElement(DiffLines, { path: 'a.ts', rows, wrap: true }))
    expect(container.querySelector('.whitespace-pre-wrap')).not.toBeNull()
    expect(container.querySelector('.overflow-x-auto')).toBeNull()
    unmount()

    const step = render(createElement(DiffLines, { path: 'a.ts', rows }))
    expect(step.container.querySelector('.whitespace-pre')).not.toBeNull()
    expect(step.container.querySelector('.whitespace-pre-wrap')).toBeNull()
    expect(step.container.querySelector('.overflow-x-auto')).not.toBeNull()
  })
})

// Where the list stops and the file being read begins. Both panes have a floor,
// because a list under a heading and a few rows and a diff under a hunk are
// furniture rather than somewhere to work.
describe('the split between the two panes', () => {
  it('holds both panes above their floor', () => {
    expect(clampSplit(10, 900)).toBe(LIST_MIN)
    expect(clampSplit(880, 900)).toBe(900 - DIFF_MIN)
    expect(clampSplit(300, 900)).toBe(300)
  })

  // A panel dragged short has no room for either floor, so it is halved rather
  // than handing the list more than the window has.
  it('halves a panel too short for both', () => {
    expect(clampSplit(500, 200)).toBe(100)
  })

  it('opens on a list that is worth reading', () => {
    const first = defaultSplit(900)
    expect(first).toBeGreaterThanOrEqual(LIST_MIN)
    expect(first).toBeLessThanOrEqual(900 - DIFF_MIN)
  })
})

describe('the branch a review is of', () => {
  const branches = [
    { name: 'main', current: true, remote: false },
    { name: 'feature/tickets', current: false, remote: false },
    { name: 'ali/spike', current: false, remote: true }
  ]

  const rows = (): string[] => [...document.querySelectorAll('[data-row]')].map(el => el.textContent ?? '')

  const row = (name: string): HTMLElement =>
    [...document.querySelectorAll<HTMLElement>('[data-row]')].find(el => el.textContent === name) as HTMLElement

  const openBranches = async () => {
    render(createElement(ReviewView))
    fireEvent.click(await screen.findByRole('button', { name: /main/ }))
    return screen.findByLabelText('Find a branch')
  }

  it('opens every branch there is off the name of the one you are on', async () => {
    bridge(work({ branches }))
    await openBranches()

    expect(screen.getByText('feature/tickets')).not.toBeNull()
    expect(screen.getByText('ali/spike')).not.toBeNull()
    expect(screen.getByText('New branch')).not.toBeNull()
  })

  it('switches to the one that was picked', async () => {
    bridge(work({ branches }))
    await openBranches()

    fireEvent.click(button('feature/tickets'))

    await waitFor(() => expect(sent).toEqual([{ do: 'switch', branch: 'feature/tickets' }]))
  })

  it('leaves the branch you are already on alone', async () => {
    bridge(work({ branches }))
    await openBranches()

    fireEvent.click(row('main'))

    await waitFor(() => expect(screen.queryByLabelText('Find a branch')).toBeNull())
    expect(sent).toEqual([])
  })

  it('finds a branch by any part of its name', async () => {
    bridge(work({ branches }))
    const field = await openBranches()

    fireEvent.change(field, { target: { value: 'tick' } })

    expect(rows()).toEqual(['feature/tickets'])
  })

  it('makes the branch that was typed when nothing answers to it', async () => {
    bridge(work({ branches }))
    const field = await openBranches()

    fireEvent.change(field, { target: { value: 'wip' } })
    fireEvent.click(button('New branch wip'))

    await waitFor(() => expect(sent).toEqual([{ do: 'branch', name: 'wip' }]))
  })

  it('says the name git will really take rather than the one being typed', async () => {
    bridge(work({ branches }))
    const field = await openBranches()

    fireEvent.change(field, { target: { value: 'my new thing' } })
    expect(screen.getByText('New branch my-new-thing')).not.toBeNull()

    fireEvent.click(button('New branch my-new-thing'))
    await waitFor(() => expect(sent).toEqual([{ do: 'branch', name: 'my-new-thing' }]))
  })

  it('names a branch on a screen inside the same card', async () => {
    bridge(work({ branches }))
    await openBranches()

    fireEvent.click(button('New branch'))
    const field = await screen.findByPlaceholderText('Name')
    fireEvent.change(field, { target: { value: 'ali/next' } })
    fireEvent.click(button('Create'))

    await waitFor(() => expect(sent).toEqual([{ do: 'branch', name: 'ali/next' }]))
  })

  it('switches with the keys alone', async () => {
    bridge(work({ branches }))
    const field = await openBranches()

    fireEvent.change(field, { target: { value: 'spike' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() => expect(sent).toEqual([{ do: 'switch', branch: 'ali/spike' }]))
  })
})
