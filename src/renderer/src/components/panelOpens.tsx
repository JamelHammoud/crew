import { useMemo, type ReactNode } from 'react'
import {
  ChecklistGlyph,
  FolderGlyph,
  GameGlyph,
  GlobeGlyph,
  GroupGlyph,
  MusicGlyph,
  TerminalGlyph,
  TicketGlyph
} from '../icons'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'

// The one table of what the side panel can hold. The menu the plus opens and
// the screen an empty panel shows both read it, so the words somebody picked
// from are the words they are shown either way.
//
// The thread's own things stand first and come and go with the thread you are
// in. The rest are always there, so nothing under the pointer moves as you
// travel.

export type PanelOpen = {
  id: string
  label: string
  mark: ReactNode
  // Whether the row belongs to the thread you are in or to the panel itself.
  // It is what the menu draws its one divider from, so the pair of groups is
  // read the same way the list is ordered.
  scope: 'thread' | 'panel'
  open: () => void
}

export function usePanelOpens(): PanelOpen[] {
  const threadId = useCrew(s => s.openThreadId)
  const plan = useCrew(s => (s.openThreadId ? Boolean(s.threads[s.openThreadId]?.plan) : false))
  const tickets = useCrew(s => (s.openThreadId ? Boolean(s.threads[s.openThreadId]?.tickets) : false))
  const events = useCrew(s => s.events)
  const helpers = useMemo(
    () => Boolean(threadId) && events.some(e => e.kind === 'subagent.started' && e.parentThreadId === threadId),
    [events, threadId]
  )

  return useMemo(() => {
    const browser = useBrowser.getState
    const rows: PanelOpen[] = []
    if (threadId && plan)
      rows.push({ id: 'plan', label: 'Plan', mark: <ChecklistGlyph />, open: () => browser().showPlan(threadId) })
    if (threadId && tickets)
      rows.push({ id: 'work', label: 'Board', mark: <TicketGlyph />, open: () => browser().showWork(threadId) })
    if (threadId && helpers)
      rows.push({
        id: 'agent',
        label: 'Helpers',
        mark: <GroupGlyph />,
        open: () => browser().showSubagents(threadId)
      })
    rows.push(
      { id: 'web', label: 'Web page', mark: <GlobeGlyph />, open: () => browser().addTab() },
      { id: 'terminal', label: 'Terminal', mark: <TerminalGlyph />, open: () => browser().addTerminal() },
      { id: 'file', label: 'Files', mark: <FolderGlyph />, open: () => browser().openFiles() },
      { id: 'music', label: 'Music', mark: <MusicGlyph />, open: () => browser().openMusic() },
      { id: 'game', label: 'Games', mark: <GameGlyph />, open: () => browser().openGame() }
    )
    return rows
  }, [threadId, plan, tickets, helpers])
}
