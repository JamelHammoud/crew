import { promises as fs } from 'node:fs'
import path from 'node:path'
import { overwrittenPaths, restoreAutostash, runGit, stashCount, takeSyncLock, type GitResult } from '../shared/git'
import { cleanBranchName } from '../shared/branch'
import { interruptedStates } from '../shared/gitState'
import type {
  RepoActionResult,
  RepoBranch,
  RepoChange,
  RepoChangeKind,
  RepoCommand,
  RepoStash,
  RepoStatus,
  RepoWork
} from '../shared/repository'

const PROJECT_PATHS = ['.', ':(exclude).crew', ':(exclude).crew/**']
const DIFF_LIMIT = 200_000
const DIFF_LINE_LIMIT = 2_000
const UNIT = '\u001f'
const BRANCH_LIST_LIMIT = 200
const AUTO_SYNC_MS = 5000
const DEBOUNCE_MS = 2000
const TROUBLE_AFTER = 3

interface StatusEntry {
  code: string
  path: string
  previousPath?: string
}

// Pull and push are the ones that reach the remote, and they are already
// written. What is left is everything that happens in this folder.
type LocalCommand = Exclude<RepoCommand, { do: 'pull' } | { do: 'push' }>

export class GitSync {
  private chain: Promise<void> = Promise.resolve()
  private timer: NodeJS.Timeout | null = null
  private loop: NodeJS.Timeout | null = null
  private looping = false
  private waiting: Promise<void> | null = null
  private hasRemote: boolean | null = null
  private inRepo: boolean | null = null
  private stalls = 0
  onLog: (line: string) => void = () => {}
  onTrouble: () => void = () => {}

  constructor(private repoPath: string) {}

  // The next pass is armed once this one has settled, never on a timer of its
  // own. A pass that runs longer than the interval leaves the queue one longer
  // every time, and a prompt waits behind all of it.
  start(intervalMs = AUTO_SYNC_MS): void {
    this.stop()
    this.looping = true
    const tick = (): void => {
      void this.syncNow().then(() => {
        if (!this.looping) return
        this.loop = setTimeout(tick, intervalMs)
        this.loop.unref?.()
      })
    }
    tick()
  }

  schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.syncNow(), DEBOUNCE_MS)
  }

  stop(): void {
    this.looping = false
    if (this.timer) clearTimeout(this.timer)
    if (this.loop) clearTimeout(this.loop)
    this.timer = null
    this.loop = null
  }

  // Stopping only stands the loop down, so a pass already under way is still
  // committing and pushing somebody's work. This is what waits it out, and it is
  // what a quit that is about to replace the app under itself has to hold for.
  // Nothing new is started: the pass in flight commits whatever is on disk.
  quiet(): Promise<void> {
    return this.chain.catch(() => {})
  }

  // A pass that has not started yet is the pass everyone asking now wants: it
  // commits whatever is on disk by the time it runs, so a second one queued
  // behind it would find nothing left to do. Only a pass already under way is
  // waited out, which holds the queue at one running and one waiting.
  syncNow(message = 'crew sync'): Promise<void> {
    if (this.waiting) return this.waiting
    const pass = this.enqueue(() => {
      this.waiting = null
      return this.sync(message)
    }).catch(() => {})
    this.waiting = pass
    return pass
  }

  status(): Promise<RepoStatus> {
    return this.enqueue(() => this.readStatus())
  }

  changes(): Promise<RepoChange[]> {
    return this.enqueue(() => this.readChanges())
  }

  stashes(): Promise<RepoStash[]> {
    return this.enqueue(() => this.readStashes())
  }

  // What the review panel polls, so it is one read of the repo rather than
  // three that can disagree with each other halfway through a sync.
  work(): Promise<RepoWork> {
    return this.enqueue(() => this.readWork())
  }

  // Every verb takes the sync lock the automatic passes take. A stage that
  // interleaves with a pass that is committing the whole tree is how work is
  // lost, so a busy folder is told to wait rather than run anyway.
  run(command: RepoCommand): Promise<RepoActionResult> {
    if (command.do === 'pull') return this.pullNow()
    if (command.do === 'push') return this.pushNow()
    return this.enqueue(() => this.exclusive(() => this.act(command)))
  }

  pullNow(): Promise<RepoActionResult> {
    return this.enqueue(() => this.exclusive(() => this.pullAction()))
  }

  pushNow(message = 'crew sync'): Promise<RepoActionResult> {
    return this.enqueue(() => this.exclusive(() => this.pushAction(message)))
  }

  private async exclusive(action: () => Promise<RepoActionResult>): Promise<RepoActionResult> {
    const release = await takeSyncLock(this.repoPath)
    if (!release) {
      return this.result(
        false,
        false,
        'This project is syncing right now. Try again in a moment.',
        await this.readStatus()
      )
    }
    try {
      return await action()
    } finally {
      await release()
    }
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = this.chain.then(action, action)
    this.chain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  // The whole working tree goes out on every pass. A session is only useful
  // when the code everyone is looking at is the same code.
  private async sync(message: string): Promise<void> {
    if (!(await this.usable())) return
    const release = await takeSyncLock(this.repoPath)
    if (!release) return
    try {
      await this.syncLocked(message)
    } finally {
      await release()
    }
  }

  private async syncLocked(message: string): Promise<void> {
    if (!(await this.settle())) {
      this.onLog('this folder is stuck part way through a git operation, will retry')
      return
    }
    const commit = await this.commitWorkingTree(message)
    if (!commit.ok) {
      this.onLog(`commit failed: ${commit.detail}`)
      return
    }
    await this.refreshRemote()
    if (!this.hasRemote) return
    // Everything is committed by the time we get here, so there is nothing to
    // autostash. Stashing here is what used to strand people's work.
    const pull = await this.pullRemote(false)
    if (!pull.ok) {
      this.onLog(`pull failed, will retry: ${pull.detail}`)
      return this.stalled()
    }
    const { push } = await this.pushCurrent()
    if (push.code !== 0) {
      this.onLog(`push failed, will retry: ${push.stderr.trim()}`)
      return this.stalled()
    }
    this.stalls = 0
  }

  private stalled(): void {
    this.stalls += 1
    if (this.stalls === TROUBLE_AFTER) this.onTrouble()
  }

  private async usable(): Promise<boolean> {
    if (this.inRepo === null) {
      const repo = await runGit(['rev-parse', '--is-inside-work-tree'], this.repoPath)
      this.inRepo = repo.code === 0 && repo.stdout.trim() === 'true'
    }
    return this.inRepo
  }

  private async pullAction(): Promise<RepoActionResult> {
    const before = await this.readStatus()
    if (!before.available) {
      return this.result(false, false, 'This project is not tracked with git.', before)
    }
    if (!before.remote) {
      return this.result(false, false, 'No remote is set up for this project.', before)
    }
    const blocked = await this.blockedPaths()
    if (blocked.length > 0) {
      return this.result(
        false,
        false,
        `Push your changes to ${describePaths(blocked)} first, a pull would replace them.`,
        before
      )
    }
    const pull = await this.pullRemote(true)
    const status = await this.readStatus()
    if (!pull.ok) return this.result(false, false, `Could not pull. ${pull.detail}`, status)
    return this.result(true, pull.updated, pull.updated ? 'Pulled the latest changes.' : 'Already up to date.', status)
  }

  private async pushAction(message: string): Promise<RepoActionResult> {
    const before = await this.readStatus()
    if (!before.available) {
      return this.result(false, false, 'This project is not tracked with git.', before)
    }
    if (!before.remote) {
      return this.result(false, false, 'No remote is set up for this project.', before)
    }
    const commit = await this.commitWorkingTree(message)
    if (!commit.ok) {
      const status = await this.readStatus()
      return this.result(false, false, `Could not save changes. ${commit.detail}`, status)
    }
    const pull = await this.pullRemote(false)
    if (!pull.ok) {
      const status = await this.readStatus()
      return this.result(false, false, `Could not pull before pushing. ${pull.detail}`, status)
    }
    const { push, published } = await this.pushCurrent()
    const status = await this.readStatus()
    if (push.code !== 0) {
      return this.result(false, false, `Could not push. ${gitDetail(push)}`, status)
    }
    const hadChanges = commit.updated || pull.updated || before.ahead > 0 || published
    return this.result(true, hadChanges, hadChanges ? 'Pushed the latest changes.' : 'Already up to date.', status)
  }

  private async act(command: LocalCommand): Promise<RepoActionResult> {
    const status = await this.readStatus()
    if (!status.available) {
      return this.result(false, false, 'This project is not tracked with git.', status)
    }
    switch (command.do) {
      case 'stage':
        return this.stageAction(command.paths)
      case 'unstage':
        return this.unstageAction(command.paths)
      case 'discard':
        return this.discardAction(command.paths)
      case 'commit':
        return this.commitAction(command.message, command.amend === true)
      case 'stash':
        return this.stashAction(command.message, command.keepIndex === true)
      case 'apply':
        return this.stashRefAction(command.ref, 'pop')
      case 'drop':
        return this.stashRefAction(command.ref, 'drop')
      case 'switch':
        return this.switchAction(command.branch)
      case 'branch':
        return this.branchAction(command.name)
    }
  }

  private async switchAction(branch: string): Promise<RepoActionResult> {
    const known = (await this.readBranches()).find(one => one.name === branch)
    if (!known) return this.done(false, false, 'That branch is not there any more.')
    if (known.current) return this.done(true, false, `Already on ${branch}.`)
    const go = await runGit(['switch', branch], this.repoPath)
    if (go.code !== 0) return this.done(false, false, `Could not switch. ${gitDetail(go)}`)
    return this.done(true, true, `Switched to ${branch}.`)
  }

  private async branchAction(name: string): Promise<RepoActionResult> {
    const wanted = cleanBranchName(name)
    if (!wanted) return this.done(false, false, 'Give the branch a name first.')
    const make = await runGit(['switch', '-c', wanted], this.repoPath)
    if (make.code !== 0) return this.done(false, false, `Could not create that branch. ${gitDetail(make)}`)
    return this.done(true, true, `Switched to ${wanted}.`)
  }

  private async stageAction(paths: string[]): Promise<RepoActionResult> {
    const named = await this.namedPaths(paths)
    if (!named) return this.done(false, false, 'Those changes are not there any more.')
    const add = await runGit(['add', '--', ...named], this.repoPath)
    if (add.code !== 0) return this.done(false, false, `Could not stage. ${gitDetail(add)}`)
    return this.done(true, true, `Staged ${describePaths(named)}.`)
  }

  // A project with nothing committed yet has no HEAD to reset against, and
  // reset there fails without taking anything back out of the index.
  private async unstageAction(paths: string[]): Promise<RepoActionResult> {
    const named = await this.namedPaths(paths)
    if (!named) return this.done(false, false, 'Those changes are not there any more.')
    const head = await runGit(['rev-parse', '--verify', 'HEAD'], this.repoPath)
    const args = head.code === 0 ? ['reset', 'HEAD', '--'] : ['rm', '--cached', '--']
    const reset = await runGit([...args, ...named], this.repoPath)
    if (reset.code !== 0) return this.done(false, false, `Could not unstage. ${gitDetail(reset)}`)
    return this.done(true, true, `Unstaged ${describePaths(named)}.`)
  }

  // The one verb that throws work away, so it only ever touches the paths git
  // itself just reported and never widens past them.
  private async discardAction(paths: string[]): Promise<RepoActionResult> {
    const entries = await this.statusEntries()
    const named = this.knownOf(entries, paths)
    if (!named) return this.done(false, false, 'Those changes are not there any more.')
    const untracked = new Set(entries.filter(entry => entry.code === '??').map(entry => entry.path))
    const tracked = named.filter(name => !untracked.has(name))
    if (tracked.length > 0) {
      const restore = await runGit(['checkout', '--', ...tracked], this.repoPath)
      if (restore.code !== 0) {
        return this.done(false, false, `Could not undo those changes. ${gitDetail(restore)}`)
      }
    }
    for (const name of named.filter(name => untracked.has(name))) {
      const target = path.resolve(this.repoPath, name)
      if (!insideRepo(this.repoPath, target)) continue
      await fs.rm(target, { force: true, recursive: true }).catch(() => {})
    }
    return this.done(true, true, `Undid the changes to ${describePaths(named)}.`)
  }

  private async commitAction(message: string, amend: boolean): Promise<RepoActionResult> {
    const text = message.trim()
    if (!text) return this.done(false, false, 'Write a message for this commit first.')
    const staged = await runGit(['diff', '--cached', '--quiet'], this.repoPath)
    if (staged.code === 0 && !amend) {
      return this.done(false, false, 'Stage something to commit first.')
    }
    const args = ['-c', 'core.editor=true', 'commit', '-m', text]
    if (amend) args.push('--amend')
    const commit = await runGit(args, this.repoPath)
    if (commit.code !== 0) return this.done(false, false, `Could not commit. ${gitDetail(commit)}`)
    return this.done(true, true, amend ? 'Amended the last commit.' : 'Committed the staged changes.')
  }

  // A stash that leaves new files behind is how work is stranded, so untracked
  // files go with it. The session's own files stay where they are.
  private async stashAction(message: string | undefined, keepIndex: boolean): Promise<RepoActionResult> {
    const args = ['stash', 'push', '--include-untracked']
    if (keepIndex) args.push('--keep-index')
    const text = message?.trim()
    if (text) args.push('-m', text)
    const before = await stashCount(this.repoPath)
    const stash = await runGit([...args, '--', ...PROJECT_PATHS], this.repoPath)
    if (stash.code !== 0) return this.done(false, false, `Could not stash. ${gitDetail(stash)}`)
    if ((await stashCount(this.repoPath)) === before) {
      return this.done(true, false, 'There was nothing to put away.')
    }
    return this.done(true, true, 'Put your changes away.')
  }

  private async stashRefAction(ref: string, verb: 'pop' | 'drop'): Promise<RepoActionResult> {
    const held = await this.readStashes()
    const found = held.find(stash => stash.ref === ref)
    if (!found) return this.done(false, false, 'That is not there any more.')
    const result = await runGit(['stash', verb, found.ref], this.repoPath)
    if (result.code !== 0) {
      const detail = gitDetail(result)
      return this.done(
        false,
        false,
        verb === 'pop' ? `Could not bring those changes back. ${detail}` : `Could not drop that. ${detail}`
      )
    }
    return this.done(true, true, verb === 'pop' ? 'Brought those changes back.' : 'Dropped it.')
  }

  private async done(ok: boolean, updated: boolean, message: string): Promise<RepoActionResult> {
    return this.result(ok, updated, message, await this.readStatus())
  }

  // A path a caller made up is a path outside the project, so a command is only
  // ever run on what git has just reported as changed.
  private async namedPaths(paths: string[]): Promise<string[] | null> {
    return this.knownOf(await this.statusEntries(), paths)
  }

  private knownOf(entries: StatusEntry[], paths: string[]): string[] | null {
    if (paths.length === 0) return null
    const known = new Set<string>()
    for (const entry of entries) {
      known.add(entry.path)
      if (entry.previousPath) known.add(entry.previousPath)
    }
    const named = paths.filter(name => known.has(name))
    return named.length === paths.length ? named : null
  }

  private async commitWorkingTree(
    message: string,
    paths?: string[]
  ): Promise<{ ok: boolean; updated: boolean; detail: string }> {
    const scope = paths ? ['--', ...paths] : []
    const add = await runGit(['add', '-A', ...scope], this.repoPath)
    if (add.code !== 0) return { ok: false, updated: false, detail: gitDetail(add) }
    const staged = await runGit(['diff', '--cached', '--quiet', ...scope], this.repoPath)
    if (staged.code === 0) return { ok: true, updated: false, detail: '' }
    const commit = await runGit(['commit', '-m', message, ...scope], this.repoPath)
    return {
      ok: commit.code === 0,
      updated: commit.code === 0,
      detail: commit.code === 0 ? '' : gitDetail(commit)
    }
  }

  // Merging, not rebasing. A rebase replays every local commit, rewriting the
  // working tree once per commit, and each rewrite can land on top of a file an
  // agent is writing right now. A merge leaves local commits alone and touches
  // only what actually came in.
  private async upstream(): Promise<boolean> {
    const named = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], this.repoPath)
    return named.code === 0 && named.stdout.trim().length > 0
  }

  private async pushCurrent(): Promise<{ push: GitResult; published: boolean }> {
    if (await this.upstream()) return { push: await runGit(['push'], this.repoPath), published: false }
    const [remotes, branch] = await Promise.all([
      runGit(['remote'], this.repoPath),
      runGit(['branch', '--show-current'], this.repoPath)
    ])
    const names = remotes.stdout
      .split(/\r?\n/)
      .map(one => one.trim())
      .filter(Boolean)
    const target = names.includes('origin') ? 'origin' : names[0]
    const name = branch.stdout.trim()
    if (!target || !name) return { push: await runGit(['push'], this.repoPath), published: false }
    const push = await runGit(['push', '--set-upstream', target, name], this.repoPath)
    return { push, published: push.code === 0 }
  }

  private async pullRemote(autostash: boolean): Promise<{ ok: boolean; updated: boolean; detail: string }> {
    if (!(await this.upstream())) return { ok: true, updated: false, detail: '' }
    const before = await runGit(['rev-parse', 'HEAD'], this.repoPath)
    const stashes = await stashCount(this.repoPath)
    const args = ['pull', '--no-rebase', '--no-edit']
    if (autostash) args.push('--autostash')
    const pull = await runGit(args, this.repoPath)
    if (pull.code !== 0) {
      if (!(await this.mergeActive())) {
        await restoreAutostash(this.repoPath, stashes)
        return { ok: false, updated: false, detail: gitDetail(pull) }
      }
      if (!(await this.resolveMergeConflicts())) {
        await this.abortKeepingWork(['merge', '--abort'])
        await restoreAutostash(this.repoPath, stashes)
        return { ok: false, updated: false, detail: gitDetail(pull) }
      }
    }
    const after = await runGit(['rev-parse', 'HEAD'], this.repoPath)
    return {
      ok: true,
      updated: before.code === 0 && after.code === 0 && before.stdout.trim() !== after.stdout.trim(),
      detail: ''
    }
  }

  private async mergeActive(): Promise<boolean> {
    return (await interruptedStates(this.repoPath)).some(state => state.label === 'merge')
  }

  // session.json is a snapshot this machine rewrites on every poll, so a
  // conflicted hunk carries nothing worth merging. Everything else is real work
  // and a person has to look at it.
  private async resolveMergeConflicts(): Promise<boolean> {
    const conflicts = await runGit(['diff', '--name-only', '--diff-filter=U'], this.repoPath)
    const files = conflicts.stdout.trim().split('\n').filter(Boolean)
    if (files.length === 0 || files.some(file => !file.endsWith('session.json'))) return false
    const take = await runGit(['checkout', '--ours', '--', ...files], this.repoPath)
    if (take.code !== 0) return false
    await runGit(['add', '--', ...files], this.repoPath)
    const commit = await runGit(['-c', 'core.editor=true', 'commit', '--no-edit'], this.repoPath)
    return commit.code === 0
  }

  private async blockedPaths(): Promise<string[]> {
    const fetch = await runGit(['fetch', '--quiet'], this.repoPath)
    if (fetch.code !== 0) return []
    return overwrittenPaths(this.repoPath)
  }

  // A machine that was closed mid-rebase comes back to a repo git will not let
  // anyone commit to. Finish the rebase if it can be finished, otherwise back
  // out of it, and either way keep whatever was written in the meantime.
  private async settle(): Promise<boolean> {
    const states = await interruptedStates(this.repoPath)
    if (states.length === 0) return true
    const labels = states.map(state => state.label)
    // A rebase only ever gets here from outside crew now, but a machine that was
    // closed part way through one still has to be dug out.
    if (labels.includes('rebase') && (await this.resolveRebaseConflicts())) {
      this.onLog('picked up an interrupted rebase and finished it')
      return true
    }
    if (labels.includes('merge') && (await this.resolveMergeConflicts())) {
      this.onLog('picked up an interrupted merge and finished it')
      return true
    }
    for (const state of states) await this.abortKeepingWork(state.abort)
    const left = await interruptedStates(this.repoPath)
    if (left.length > 0) return false
    this.onLog(`backed out of an interrupted ${states.map(state => state.label).join(' and ')}`)
    return true
  }

  // Aborting resets the working tree, which is how a half-written chat log or a
  // file an agent just wrote used to disappear. Put those files back afterwards.
  private async abortKeepingWork(abort: string[]): Promise<void> {
    const kept = await this.readPending()
    await runGit(abort, this.repoPath)
    for (const [file, contents] of kept) {
      const target = path.resolve(this.repoPath, file)
      try {
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, file.endsWith('.jsonl') ? await mergedLines(target, contents) : contents)
      } catch {
        // a path that cannot be written back is one git already owns
      }
    }
  }

  private async readPending(): Promise<Map<string, Buffer>> {
    const status = await runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all'], this.repoPath)
    if (status.code !== 0) return new Map()
    const kept = new Map<string, Buffer>()
    for (const entry of parseStatus(status.stdout)) {
      // a conflicted file holds markers, not work worth restoring
      if (entry.code.includes('U') || entry.code === 'AA' || entry.code === 'DD') continue
      try {
        kept.set(entry.path, await fs.readFile(path.resolve(this.repoPath, entry.path)))
      } catch {
        // deleted or unreadable, nothing to keep
      }
    }
    return kept
  }

  private async readStatus(): Promise<RepoStatus> {
    const repo = await runGit(['rev-parse', '--is-inside-work-tree'], this.repoPath)
    if (repo.code !== 0 || repo.stdout.trim() !== 'true') {
      return { available: false, remote: false, branch: '', changed: 0, ahead: 0, behind: 0, stashes: 0 }
    }
    const [branch, changes, remotes, divergence, stashes] = await Promise.all([
      runGit(['branch', '--show-current'], this.repoPath),
      runGit(['status', '--porcelain', '--', ...PROJECT_PATHS], this.repoPath),
      runGit(['remote'], this.repoPath),
      runGit(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], this.repoPath),
      stashCount(this.repoPath)
    ])
    const [ahead = 0, behind = 0] =
      divergence.code === 0
        ? divergence.stdout
            .trim()
            .split(/\s+/)
            .map(value => Number.parseInt(value, 10) || 0)
        : []
    const changed = changes.stdout.trim() ? changes.stdout.trim().split(/\r?\n/).length : 0
    const remote = remotes.code === 0 && remotes.stdout.trim().length > 0
    this.hasRemote = remote
    return {
      available: true,
      remote,
      branch: branch.stdout.trim(),
      changed,
      ahead,
      behind,
      stashes
    }
  }

  private async readWork(): Promise<RepoWork> {
    const status = await this.readStatus()
    if (!status.available) return { status, changes: [], stashes: [], branches: [] }
    const [changes, stashes, branches] = await Promise.all([
      this.readChanges(),
      this.readStashes(),
      this.readBranches()
    ])
    return { status, changes, stashes, branches }
  }

  private async readBranches(): Promise<RepoBranch[]> {
    const count = String(BRANCH_LIST_LIMIT)
    const [locals, remotes] = await Promise.all([
      runGit(
        [
          'for-each-ref',
          '--sort=-committerdate',
          '--count',
          count,
          `--format=%(refname:short)${UNIT}%(HEAD)`,
          'refs/heads'
        ],
        this.repoPath
      ),
      runGit(
        ['for-each-ref', '--sort=-committerdate', '--count', count, '--format=%(refname:short)', 'refs/remotes'],
        this.repoPath
      )
    ])
    if (locals.code !== 0) return []
    const here: RepoBranch[] = []
    const held = new Set<string>()
    for (const row of locals.stdout.split(/\r?\n/)) {
      const [name = '', head = ''] = row.trim().split(UNIT)
      if (!name) continue
      held.add(name)
      here.push({ name, current: head.trim() === '*', remote: false })
    }
    return [...here, ...this.remoteOnly(remotes, held)].slice(0, BRANCH_LIST_LIMIT)
  }

  private remoteOnly(remotes: GitResult, held: Set<string>): RepoBranch[] {
    if (remotes.code !== 0) return []
    const order: string[] = []
    const times = new Map<string, number>()
    for (const row of remotes.stdout.split(/\r?\n/)) {
      const ref = row.trim()
      const cut = ref.indexOf('/')
      if (cut < 0) continue
      const name = ref.slice(cut + 1)
      if (!name || name === 'HEAD' || held.has(name)) continue
      if (!times.has(name)) order.push(name)
      times.set(name, (times.get(name) ?? 0) + 1)
    }
    return order.filter(name => times.get(name) === 1).map(name => ({ name, current: false, remote: true }))
  }

  private async readStashes(): Promise<RepoStash[]> {
    const list = await runGit(['stash', 'list', '-z', `--format=%gd${UNIT}%gs`], this.repoPath)
    if (list.code !== 0) return []
    return list.stdout
      .split('\0')
      .filter(Boolean)
      .map(record => stashOf(record))
  }

  private async statusEntries(): Promise<StatusEntry[]> {
    const status = await runGit(
      ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...PROJECT_PATHS],
      this.repoPath
    )
    if (status.code !== 0) return []
    return parseStatus(status.stdout)
  }

  // A file edited after it was staged is two changes, because the index and the
  // file on disk hold two different diffs and the panel lists them apart.
  private async readChanges(): Promise<RepoChange[]> {
    const entries = await this.statusEntries()
    const changes = await Promise.all(
      entries.flatMap(entry => sidesOf(entry).map(staged => this.readChange(entry, staged)))
    )
    return changes.sort((a, b) => a.path.localeCompare(b.path) || Number(b.staged) - Number(a.staged))
  }

  private async readChange(entry: StatusEntry, staged: boolean): Promise<RepoChange> {
    const kind = sideKind(entry, staged)
    if (entry.code === '??') return this.readNewFile(entry, kind, staged)
    const scope = entry.previousPath ? [entry.path, entry.previousPath] : [entry.path]
    const args = ['diff', '--no-ext-diff', '--no-color', '--unified=3']
    if (staged) args.push('--cached')
    const result = await runGit([...args, '--', ...scope], this.repoPath)
    if (result.code !== 0 && kind === 'added') return this.readNewFile(entry, kind, staged)
    const diff = result.stdout
    const counts = diffCounts(diff)
    const binary = /^Binary files |^GIT binary patch/m.test(diff)
    const preview = diffPreview(diff)
    return {
      path: entry.path,
      previousPath: entry.previousPath,
      kind,
      staged,
      added: counts.added,
      removed: counts.removed,
      diff: preview.diff,
      binary,
      truncated: preview.truncated
    }
  }

  private async readNewFile(entry: StatusEntry, kind: RepoChangeKind, staged: boolean): Promise<RepoChange> {
    const empty = {
      path: entry.path,
      previousPath: entry.previousPath,
      kind,
      staged,
      added: 0,
      removed: 0,
      diff: '',
      binary: false,
      truncated: false
    }
    try {
      const target = path.resolve(this.repoPath, entry.path)
      const stat = await fs.lstat(target)
      if (!stat.isFile()) return { ...empty, binary: stat.isSymbolicLink() }
      const handle = await fs.open(target, 'r')
      const length = Math.min(stat.size, DIFF_LIMIT + 1)
      const buffer = Buffer.alloc(length)
      let bytesRead = 0
      try {
        bytesRead = (await handle.read(buffer, 0, length, 0)).bytesRead
      } finally {
        await handle.close()
      }
      const contents = buffer.subarray(0, Math.min(bytesRead, DIFF_LIMIT))
      if (contents.includes(0)) {
        return { ...empty, binary: true, truncated: stat.size > DIFF_LIMIT }
      }
      const text = contents.toString('utf8').replace(/\r\n/g, '\n')
      const lines = text ? text.split('\n') : []
      if (lines.at(-1) === '') lines.pop()
      const previewLines = lines.slice(0, DIFF_LINE_LIMIT)
      const diff =
        previewLines.length === 0
          ? ''
          : [
              `diff --git a/${entry.path} b/${entry.path}`,
              'new file mode 100644',
              '--- /dev/null',
              `+++ b/${entry.path}`,
              `@@ -0,0 +1,${lines.length} @@`,
              ...previewLines.map(line => `+${line}`)
            ].join('\n')
      return {
        ...empty,
        added: lines.length,
        diff: diff.slice(0, DIFF_LIMIT),
        truncated: stat.size > DIFF_LIMIT || lines.length > DIFF_LINE_LIMIT || diff.length > DIFF_LIMIT
      }
    } catch {
      return empty
    }
  }

  private async refreshRemote(): Promise<void> {
    if (this.hasRemote !== null) return
    const remotes = await runGit(['remote'], this.repoPath)
    this.hasRemote = remotes.code === 0 && remotes.stdout.trim().length > 0
  }

  private result(ok: boolean, updated: boolean, message: string, status: RepoStatus): RepoActionResult {
    return { ok, updated, message, status }
  }

  private async resolveRebaseConflicts(): Promise<boolean> {
    for (let i = 0; i < 50; i++) {
      const conflicts = await runGit(['diff', '--name-only', '--diff-filter=U'], this.repoPath)
      const files = conflicts.stdout.trim().split('\n').filter(Boolean)
      if (files.length === 0) {
        // A rebase stopped with nothing conflicting still has commits left to
        // replay. Carry on with them; skipping here would throw one away.
        const cont = await runGit(['-c', 'core.editor=true', 'rebase', '--continue'], this.repoPath)
        if (cont.code === 0) return true
        const output = `${cont.stderr}${cont.stdout}`
        if (!/no changes|did you forget|nothing to commit/i.test(output)) return false
        // the commit became empty once replayed, so there is nothing to keep
        const skip = await runGit(['rebase', '--skip'], this.repoPath)
        if (skip.code === 0) return true
        const recheck = await runGit(['diff', '--name-only', '--diff-filter=U'], this.repoPath)
        if (!recheck.stdout.trim()) return false
        continue
      }
      if (files.some(f => !f.endsWith('session.json'))) return false
      const take = await runGit(['checkout', '--theirs', '--', ...files], this.repoPath)
      if (take.code !== 0) return false
      await runGit(['add', '--', ...files], this.repoPath)
      const cont = await runGit(['-c', 'core.editor=true', 'rebase', '--continue'], this.repoPath)
      if (cont.code === 0) return true
    }
    return false
  }
}

function parseStatus(output: string): StatusEntry[] {
  const fields = output.split('\0')
  const entries: StatusEntry[] = []
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index]
    if (!field) continue
    const code = field.slice(0, 2)
    const entry: StatusEntry = { code, path: field.slice(3) }
    if (/[RC]/.test(code)) entry.previousPath = fields[++index] || undefined
    entries.push(entry)
  }
  return entries
}

function changeKind(code: string): RepoChangeKind {
  if (code === '??') return 'added'
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflict'
  if (code.includes('R')) return 'renamed'
  if (code.includes('C')) return 'copied'
  if (code.includes('D')) return 'deleted'
  if (code.includes('A')) return 'added'
  return 'modified'
}

// The porcelain code is the index and then the file on disk. A path that has
// both is on both lists, and a conflict is neither: nothing about it is staged
// until somebody has settled it.
function sidesOf(entry: StatusEntry): boolean[] {
  if (entry.code === '??' || changeKind(entry.code) === 'conflict') return [false]
  const index = entry.code[0] ?? ' '
  const worktree = entry.code[1] ?? ' '
  const sides: boolean[] = []
  if (index !== ' ' && index !== '?') sides.push(true)
  if (worktree !== ' ') sides.push(false)
  return sides.length > 0 ? sides : [false]
}

function sideKind(entry: StatusEntry, staged: boolean): RepoChangeKind {
  const kind = changeKind(entry.code)
  if (entry.code === '??' || kind === 'conflict') return kind
  return letterKind(entry.code[staged ? 0 : 1] ?? ' ')
}

function letterKind(letter: string): RepoChangeKind {
  if (letter === 'R') return 'renamed'
  if (letter === 'C') return 'copied'
  if (letter === 'D') return 'deleted'
  if (letter === 'A') return 'added'
  return 'modified'
}

// A stash subject is "WIP on branch: subject" or "On branch: message", and a
// branch name can never hold a colon, so the first one is where it ends.
function stashOf(record: string): RepoStash {
  const [ref = '', subject = ''] = record.split(UNIT)
  const named = /^(?:WIP on|On) ([^:]+): ?(.*)$/.exec(subject)
  if (!named) return { ref, message: subject, branch: '' }
  return { ref, message: named[2], branch: named[1] }
}

function insideRepo(root: string, target: string): boolean {
  const rel = path.relative(root, target)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function diffCounts(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  let hunk = false
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      hunk = false
    } else if (line.startsWith('@@')) {
      hunk = true
    } else if (hunk && line.startsWith('+')) {
      added++
    } else if (hunk && line.startsWith('-')) {
      removed++
    }
  }
  return { added, removed }
}

function diffPreview(diff: string): { diff: string; truncated: boolean } {
  const lines = diff.split(/\r?\n/)
  const preview = lines.slice(0, DIFF_LINE_LIMIT).join('\n')
  return {
    diff: preview.slice(0, DIFF_LIMIT),
    truncated: lines.length > DIFF_LINE_LIMIT || preview.length > DIFF_LIMIT
  }
}

// An event log only ever grows, so putting one back means keeping every line
// either side has rather than picking a winner.
async function mergedLines(target: string, kept: Buffer): Promise<string> {
  const current = await fs.readFile(target, 'utf8').catch(() => '')
  const lines = current.split('\n').filter(Boolean)
  const seen = new Set(lines)
  for (const line of kept.toString('utf8').split('\n')) {
    if (!line || seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }
  return `${lines.join('\n')}\n`
}

function describePaths(paths: string[]): string {
  if (paths.length === 1) return paths[0]
  if (paths.length === 2) return `${paths[0]} and ${paths[1]}`
  return `${paths[0]} and ${paths.length - 1} other files`
}

function gitDetail(result: GitResult): string {
  const text = result.stderr.trim() || result.stdout.trim() || 'Git did not finish.'
  return text.replace(/^fatal:\s*/i, '').split(/\r?\n/)[0]
}
