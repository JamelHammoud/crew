import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { AppMenuAction } from '../../../shared/appMenu'
import type { Tab } from './navTabs'
import { createDocPage } from './doc/docsPages'
import Modal from './Modal'
import SearchField from './SearchField'
import TextField from './TextField'
import { Primary } from './toolboxParts'
import { openSettings } from '../state/settings'
import { useSidebar } from '../state/sidebar'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { setWindowPinned, useWindowPinned } from '../state/windowShape'
import { toast } from '../state/toast'
import { said } from '../api/said'

type MenuCommand = {
  id: AppMenuAction
  label: string
  group: string
  session?: boolean
  thread?: boolean
}

const COMMANDS: MenuCommand[] = [
  { id: 'settings', label: 'Settings', group: 'Crew' },
  { id: 'invite', label: 'Invite someone', group: 'Crew', session: true },
  { id: 'copy-invite-link', label: 'Copy invite link', group: 'Crew', session: true },
  { id: 'people', label: 'People', group: 'Crew', session: true },
  { id: 'agents', label: 'Agents', group: 'Crew', session: true },
  { id: 'new-thread', label: 'New thread', group: 'New', session: true },
  { id: 'new-page', label: 'New page', group: 'New', session: true },
  { id: 'new-board', label: 'New board', group: 'New', session: true },
  { id: 'new-sticky', label: 'New sticky', group: 'New' },
  { id: 'open-crew', label: 'Open Crew', group: 'Crew' },
  { id: 'join-crew', label: 'Join Crew', group: 'Crew' },
  { id: 'reveal-crew', label: 'Reveal Crew in Finder', group: 'Crew', session: true },
  { id: 'toggle-sidebar', label: 'Show or hide sidebar', group: 'View', session: true },
  { id: 'toggle-panel', label: 'Show or hide side panel', group: 'View', session: true },
  { id: 'panel-review', label: 'Open Review', group: 'Panel', session: true },
  { id: 'panel-terminal', label: 'Open Terminal', group: 'Panel', session: true },
  { id: 'panel-files', label: 'Open Files', group: 'Panel', session: true },
  { id: 'panel-web', label: 'Open Web', group: 'Panel', session: true },
  { id: 'panel-music', label: 'Open Music', group: 'Panel', session: true },
  { id: 'panel-games', label: 'Open Games', group: 'Panel', session: true },
  { id: 'go-chat', label: 'Go to Chat', group: 'Go', session: true },
  { id: 'go-docs', label: 'Go to Docs', group: 'Go', session: true },
  { id: 'go-design', label: 'Go to Design', group: 'Go', session: true },
  { id: 'go-plugins', label: 'Go to Plugins', group: 'Go', session: true },
  { id: 'go-scheduled', label: 'Go to Scheduled', group: 'Go', session: true },
  { id: 'go-stickies', label: 'Go to Stickies', group: 'Go' },
  { id: 'go-browser', label: 'Go to Browser', group: 'Go', session: true },
  { id: 'go-mail', label: 'Go to Mail', group: 'Go', session: true },
  { id: 'thread-window', label: 'Open thread in window', group: 'Thread', thread: true },
  { id: 'thread-status', label: 'Mark thread done or reopen it', group: 'Thread', thread: true },
  { id: 'thread-archive', label: 'Archive thread', group: 'Thread', thread: true },
  { id: 'thread-copy-id', label: 'Copy thread ID', group: 'Thread', thread: true },
  { id: 'window-pin', label: 'Keep window on top', group: 'Thread', thread: true }
]

function matches(command: MenuCommand, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const text = `${command.label} ${command.group}`.toLowerCase()
  return words.every(word => text.includes(word))
}

export default function AppMenu({
  tab,
  onTab,
  onNewThread,
  onBack,
  onForward
}: {
  tab: Tab
  onTab: (tab: Tab) => void
  onNewThread: () => void
  onBack: () => void
  onForward: () => void
}) {
  const session = useCrew(s => s.connection !== 'home' && s.connection !== 'booting')
  const threadId = useCrew(s => s.openThreadId)
  const threadStatus = useCrew(s => (s.openThreadId ? s.threads[s.openThreadId]?.status ?? null : null))
  const sidebar = useSidebar(s => s.pinned)
  const panel = useBrowser(s => s.open)
  const pinned = useWindowPinned()
  const [palette, setPalette] = useState(false)
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [link, setLink] = useState('')
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)

  const available = useMemo(
    () =>
      COMMANDS.filter(command => (!command.session || session) && (!command.thread || Boolean(threadId))).filter(
        command => matches(command, query)
      ),
    [query, session, threadId]
  )

  useEffect(() => setAt(0), [query, palette])

  useEffect(() => {
    window.crew.setMenuContext({ session, threadId, threadStatus, sidebar, panel, pinned })
  }, [panel, pinned, session, sidebar, threadId, threadStatus])

  const openCrew = useCallback(async () => {
    const picked = await window.crew.pickFolder()
    if (!picked) return
    const name = useCrew.getState().selfName || localStorage.getItem('crew.name') || ''
    if (!name) {
      toast.fail('Add your name before opening a Crew')
      return
    }
    try {
      const plan = await window.crew.projectPlan(picked)
      useCrew.getState().connect(await window.crew.start(picked, name, { home: plan.home }))
    } catch (error) {
      toast.fail(said(error), { key: 'open-crew' })
    }
  }, [])

  const copyInvite = useCallback(async () => {
    const crew = useCrew.getState()
    const invite = crew.joinLink || (crew.hosting ? await crew.share(true) : null)
    if (!invite) {
      openSettings('people')
      return
    }
    await navigator.clipboard.writeText(invite)
    toast.done('Link copied', { key: 'join-link' })
  }, [])

  const run = useCallback(
    (action: AppMenuAction) => {
      setPalette(false)
      const crew = useCrew.getState()
      const browser = useBrowser.getState()
      if (action === 'settings') return openSettings()
      if (action === 'invite' || action === 'people') return openSettings('people')
      if (action === 'agents') return openSettings('agents')
      if (action === 'copy-invite-link') return void copyInvite()
      if (action === 'new-thread') return onNewThread()
      if (action === 'new-page') {
        onTab('docs')
        createDocPage('')
        return
      }
      if (action === 'new-board') {
        const boardId = crew.createBoard('Untitled')
        crew.openBoard(boardId)
        onTab('design')
        return
      }
      if (action === 'new-sticky' || action === 'go-stickies') return void window.crew.openStickies()
      if (action === 'open-crew') return void openCrew()
      if (action === 'join-crew') {
        setJoining(true)
        return
      }
      if (action === 'reveal-crew') return void window.crew.revealFile(crew.folder)
      if (action === 'command-palette') {
        setQuery('')
        setPalette(true)
        return
      }
      if (action === 'toggle-sidebar') return useSidebar.getState().toggle()
      if (action === 'toggle-panel') return browser.togglePanel()
      if (action === 'panel-review') return browser.openReview()
      if (action === 'panel-terminal') return browser.addTerminal(undefined, crew.folder)
      if (action === 'panel-files') return browser.openFiles()
      if (action === 'panel-web' || action === 'go-browser') return browser.addTab()
      if (action === 'panel-music') return browser.openMusic()
      if (action === 'panel-games') return browser.openGame()
      if (action === 'go-back') return onBack()
      if (action === 'go-forward') return onForward()
      if (action === 'go-chat') return onTab('chat')
      if (action === 'go-docs') return onTab('docs')
      if (action === 'go-design') return onTab('design')
      if (action === 'go-plugins') return onTab('plugins')
      if (action === 'go-scheduled') return onTab('scheduled')
      if (action === 'go-mail') return onTab('mail')
      if (!threadId) return
      if (action === 'thread-window') return void window.crew.popOutThread(threadId, crew.place)
      if (action === 'thread-status') {
        crew.setThreadStatus(threadId, threadStatus === 'done' ? 'open' : 'done')
        return
      }
      if (action === 'thread-archive') return crew.setThreadStatus(threadId, 'archived')
      if (action === 'thread-copy-id') {
        void navigator.clipboard.writeText(threadId).then(() => toast.done('Thread ID copied', { key: 'thread-id' }))
        return
      }
      if (action === 'window-pin') {
        void window.crew.setWindowPinned(!pinned).then(setWindowPinned)
      }
    },
    [copyInvite, onBack, onForward, onNewThread, onTab, openCrew, pinned, threadId, threadStatus]
  )

  useEffect(() => window.crew.onMenuAction(run), [run])

  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setAt(current => Math.min(current + 1, available.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setAt(current => Math.max(0, current - 1))
    } else if (event.key === 'Enter' && available[at]) {
      event.preventDefault()
      run(available[at].id)
    }
  }

  const join = async () => {
    const name = useCrew.getState().selfName || localStorage.getItem('crew.name') || ''
    if (!name || !link.trim() || !folder) return
    setBusy(true)
    try {
      useCrew.getState().connect(await window.crew.join(link.trim(), folder, name))
      setJoining(false)
      setLink('')
      setFolder('')
    } catch (error) {
      toast.fail(said(error), { key: 'join-crew' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open={palette}
        onClose={() => setPalette(false)}
        title="Command Palette"
        width={540}
        flush
        header={
          <SearchField value={query} onChange={setQuery} onKeyDown={keys} placeholder="Find an action" />
        }
      >
        <div className="p-2 space-y-1">
          {available.map((command, index) => (
            <button
              key={command.id}
              onClick={() => run(command.id)}
              onPointerEnter={() => setAt(index)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:scale-[0.99] ${
                index === at ? 'bg-fg/[0.09]' : 'hover:bg-fg/[0.05]'
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-sm text-fg/80">{command.label}</span>
              <span className="shrink-0 text-xs text-fg/35">{command.group}</span>
            </button>
          ))}
          {available.length === 0 && <p className="px-3 py-8 text-center text-sm text-fg/45">No actions found</p>}
        </div>
      </Modal>
      <Modal
        open={joining}
        onClose={() => setJoining(false)}
        title="Join Crew"
        footer={<Primary label={busy ? 'Joining…' : 'Join'} disabled={busy || !link.trim() || !folder} onClick={() => void join()} />}
      >
        <div className="space-y-3 pt-5">
          <TextField value={link} onChange={event => setLink(event.target.value)} placeholder="Invite link" />
          <button
            onClick={() => void window.crew.pickFolder().then(picked => picked && setFolder(picked))}
            className="w-full rounded-2xl bg-ink-800 px-4 py-3 text-left text-base text-fg transition-colors hover:bg-ink-700 active:scale-[0.99]"
          >
            {folder || 'Choose a folder'}
          </button>
        </div>
      </Modal>
    </>
  )
}
