import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState } from 'react'
import type { RepoActionResult, RepoChange, RepoStatus } from '../../../shared/repository'
import { Popover } from './Popover'
import RepoReview from './RepoReview'
import Spinner from './Spinner'
import Tooltip from './Tooltip'

type RepoAction = 'pull' | 'push'

function statusText(status: RepoStatus | null): string {
  if (!status) return 'Checking'
  if (!status.available) return 'Git unavailable'
  if (status.behind > 0) return `${status.behind} to pull`
  if (status.ahead > 0) return `${status.ahead} to push`
  if (status.changed > 0) return `${status.changed} ${status.changed === 1 ? 'change' : 'changes'}`
  if (!status.remote) return 'Local only'
  return 'Up to date'
}

function statusDetail(status: RepoStatus | null): string {
  if (!status) return 'Checking project'
  if (!status.available) return 'This project is not tracked with git'
  const details = [status.branch || 'Project']
  if (status.changed > 0) details.push(`${status.changed} local ${status.changed === 1 ? 'change' : 'changes'}`)
  if (status.ahead > 0) details.push(`${status.ahead} to push`)
  if (status.behind > 0) details.push(`${status.behind} to pull`)
  if (!status.remote) details.push('No remote')
  if (details.length === 1) details.push('Up to date')
  return details.join(' · ')
}

export default function RepoControls() {
  const [status, setStatus] = useState<RepoStatus | null>(null)
  const [action, setAction] = useState<RepoAction | null>(null)
  const [notice, setNotice] = useState<Pick<RepoActionResult, 'ok' | 'message'> | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [changes, setChanges] = useState<RepoChange[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const reviewRequest = useRef(0)

  useEffect(() => {
    let active = true
    const refresh = () => {
      const repoStatus = window.crew?.repoStatus
      if (!repoStatus) {
        if (active) {
          setStatus({ available: false, remote: false, branch: '', changed: 0, ahead: 0, behind: 0 })
        }
        return
      }
      void repoStatus()
        .then(next => {
          if (active) setStatus(next)
        })
        .catch(() => {})
    }
    refresh()
    const interval = window.setInterval(refresh, 10000)
    return () => {
      active = false
      reviewRequest.current++
      window.clearInterval(interval)
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    }
  }, [])

  const loadReview = async () => {
    const request = ++reviewRequest.current
    setReviewLoading(true)
    setReviewError(null)
    try {
      const repoChanges = window.crew?.repoChanges
      if (!repoChanges) throw new Error('Change review is unavailable.')
      const [nextStatus, nextChanges] = await Promise.all([window.crew.repoStatus(), repoChanges()])
      if (request !== reviewRequest.current) return
      setStatus(nextStatus)
      setChanges(nextChanges)
    } catch {
      if (request === reviewRequest.current) setReviewError('Could not load the project changes.')
    } finally {
      if (request === reviewRequest.current) setReviewLoading(false)
    }
  }

  const toggleReview = () => {
    if (reviewOpen) {
      setReviewOpen(false)
      return
    }
    setReviewOpen(true)
    void loadReview()
  }

  const run = async (next: RepoAction) => {
    if (action) return
    setAction(next)
    setNotice(null)
    try {
      const command = next === 'pull' ? window.crew?.pullRepo : window.crew?.pushRepo
      if (!command) throw new Error('Project sync is unavailable')
      const result = await command()
      setStatus(result.status)
      setNotice(result)
      if (next === 'push' && result.ok) {
        setChanges([])
        setReviewOpen(false)
      }
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
      noticeTimer.current = window.setTimeout(() => setNotice(null), 3000)
    } catch {
      setNotice({ ok: false, message: next === 'pull' ? 'Could not pull changes.' : 'Could not push changes.' })
    } finally {
      setAction(null)
    }
  }

  const text = notice?.message ?? statusText(status)
  const detail = notice?.message ?? statusDetail(status)
  const tone = notice ? (notice.ok ? 'text-positive' : 'text-danger') : 'text-fg-muted'
  const disabled = action !== null || !status || !status.available || !status.remote
  const reviewable = Boolean(status?.available && status.changed > 0)

  return (
    <div
      role="group"
      aria-label="Project sync"
      className="flex h-9 items-center rounded-full bg-ink-800 p-1 ring-1 ring-fg/[0.04]"
    >
      <div className="relative flex min-w-0 items-center">
        <Tooltip label={reviewable ? `${detail}. Click to review.` : detail} disabled={reviewOpen}>
          {reviewable ? (
            <button
              type="button"
              aria-label={`Review ${status?.changed} ${status?.changed === 1 ? 'change' : 'changes'}`}
              aria-expanded={reviewOpen}
              onClick={toggleReview}
              className={`flex h-7 min-w-0 items-center gap-2 rounded-full px-2 transition-colors duration-150 hover:bg-fg/[0.05] ${tone}`}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span className="max-w-[112px] truncate text-xs font-medium max-[1050px]:hidden">{text}</span>
            </button>
          ) : (
            <span className={`flex min-w-0 items-center gap-2 px-2 ${tone}`}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span className="max-w-[112px] truncate text-xs font-medium max-[1050px]:hidden">{text}</span>
            </span>
          )}
        </Tooltip>
        <Popover
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          className="w-[620px] max-w-[calc(100vw-24px)] overflow-hidden"
        >
          <RepoReview
            changes={changes}
            loading={reviewLoading}
            error={reviewError}
            pushing={action === 'push'}
            canPush={Boolean(status?.remote)}
            onPush={() => void run('push')}
          />
        </Popover>
      </div>
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      <span className="mx-0.5 h-4 w-px bg-fg/[0.07]" />
      <Tooltip label="Pull latest changes">
        <button
          type="button"
          aria-label="Pull changes"
          disabled={disabled}
          onClick={() => void run('pull')}
          className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-all duration-150 hover:bg-fg/[0.06] hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-35"
        >
          {action === 'pull' ? <Spinner size={13} /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
        </button>
      </Tooltip>
      <Tooltip label="Push changes">
        <button
          type="button"
          aria-label="Push changes"
          disabled={disabled}
          onClick={() => void run('push')}
          className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-all duration-150 hover:bg-fg/[0.06] hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-35"
        >
          {action === 'push' ? <Spinner size={13} /> : <ArrowUpIcon className="h-3.5 w-3.5" />}
        </button>
      </Tooltip>
    </div>
  )
}
