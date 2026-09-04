import { useMemo, type ReactNode } from 'react'
import {
  BranchGlyph,
  ChecklistGlyph,
  FolderGlyph,
  GameGlyph,
  GlobeGlyph,
  GroupGlyph,
  MusicGlyph,
  PhoneGlyph,
  TerminalGlyph,
  TicketGlyph
} from '../icons'
import { useBrowser } from '../state/browser'
import { useIos } from '../state/ios'
import { onMac } from '../state/platform'
import { useCrew } from '../state/store'
import { eventIndex } from './eventIndex'

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
    () => Boolean(threadId) && eventIndex(events).helperParents.has(threadId ?? ''),
    [events, threadId]
  )

  return useMemo(() => {
    const browser = useBrowser.getState
    const rows: PanelOpen[] = []
    if (threadId && plan)
      rows.push({
        id: 'plan',
        label: 'Plan',
        mark: <ChecklistGlyph />,
        scope: 'thread',
        open: () => browser().showPlan(threadId)
      })
    if (threadId && tickets)
      rows.push({
        id: 'work',
        label: 'Board',
        mark: <TicketGlyph />,
        scope: 'thread',
        open: () => browser().showWork(threadId)
      })
    if (threadId && helpers)
      rows.push({
        id: 'agent',
        label: 'Helpers',
        mark: <GroupGlyph />,
        scope: 'thread',
        open: () => browser().showSubagents(threadId)
      })
    rows.push(
      { id: 'review', label: 'Review', mark: <BranchGlyph />, scope: 'panel', open: () => browser().openReview() },
      ...(onMac()
        ? [
            {
              id: 'ios',
              label: 'Simulator',
              mark: <PhoneGlyph />,
              scope: 'panel' as const,
              open: () => useIos.getState().open()
            }
          ]
        : []),
      {
        id: 'terminal',
        label: 'Terminal',
        mark: <TerminalGlyph />,
        scope: 'panel',
        open: () => browser().addTerminal(undefined, useCrew.getState().folder)
      },
      { id: 'file', label: 'Files', mark: <FolderGlyph />, scope: 'panel', open: () => browser().openFiles() },
      { id: 'web', label: 'Web', mark: <GlobeGlyph />, scope: 'panel', open: () => browser().addTab() },
      { id: 'music', label: 'Music', mark: <MusicGlyph />, scope: 'panel', open: () => browser().openMusic() },
      { id: 'game', label: 'Games', mark: <GameGlyph />, scope: 'panel', open: () => browser().openGame() }
    )
    return rows
  }, [threadId, plan, tickets, helpers])
}
