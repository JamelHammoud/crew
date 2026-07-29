import { useState } from 'react'
import { ChevronLeftGlyph, PlusGlyph } from '../../icons'
import { useBrowser, type BrowserTab } from '../../state/browser'
import { useCrew } from '../../state/store'
import ScreenSwap from '../ScreenSwap'
import Tooltip from '../Tooltip'
import SubagentBuilder from './SubagentBuilder'
import SubagentList from './SubagentList'
import { SubagentBrief, SubagentRoster } from './SubagentRoles'
import SubagentRun from './SubagentRun'

// Every screen is inside the panel, carried by ScreenSwap the way the music
// panel carries a list. A menu hanging off the side would be a second box to
// aim at for a choice that belongs to what is already in front of you, which is
// the toolbox builder's rule and it holds here for the same reason.

const roundButton =
  'rounded-full flex items-center justify-center text-fg-secondary transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95 bg-ink-800'

type Aside = { kind: 'roles' } | { kind: 'brief'; roleId: string } | { kind: 'build'; roleId: string | null }

export default function SubagentPanel({ tab }: { tab: BrowserTab }) {
  const updateTab = useBrowser(state => state.updateTab)
  const roles = useCrew(state => state.subagents)
  const child = useCrew(state => (tab.threadId ? state.threads[tab.threadId] : undefined))
  const [aside, setAside] = useState<Aside | null>(null)

  // Where the list is: the tab's own parent, or the parent of whatever it was
  // opened on. A chip hands over the helper alone, so the way back out of one
  // is worked out here rather than being carried around.
  const parentThreadId = tab.parentThreadId || child?.parentThreadId || ''
  const role = aside?.kind === 'brief' ? roles.find(one => one.id === aside.roleId) : undefined
  const editing = aside?.kind === 'build' && aside.roleId ? roles.find(one => one.id === aside.roleId) : undefined

  const screen = aside
    ? aside.kind === 'roles'
      ? 'roles'
      : `${aside.kind}:${aside.roleId ?? 'new'}`
    : tab.threadId
      ? `run:${tab.threadId}`
      : 'list'
  const depth = aside ? (aside.kind === 'roles' ? 1 : 2) : tab.threadId ? 1 : 0

  const open = (threadId: string) => updateTab(tab.id, { threadId, parentThreadId })
  const out = () => {
    setAside(null)
    updateTab(tab.id, { threadId: '', parentThreadId })
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2">
        <ScreenSwap screen={depth > 0 ? 'back' : 'top'} depth={depth > 0 ? 1 : 0}>
          {depth > 0 ? (
            <Tooltip label="All helpers">
              <button onClick={out} aria-label="All helpers" className={`${roundButton} w-8 h-8`}>
                <ChevronLeftGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          ) : (
            <span className="text-sm font-semibold text-fg pl-1">Helpers</span>
          )}
        </ScreenSwap>
        <span className="flex-1" />
        {parentThreadId && !aside && (
          <Tooltip label="Send one out">
            <button
              onClick={() => setAside({ kind: 'roles' })}
              aria-label="Send one out"
              className={`${roundButton} w-8 h-8`}
            >
              <PlusGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <ScreenSwap screen={screen} depth={depth} fill>
          {aside?.kind === 'build' ? (
            <SubagentBuilder role={editing ?? null} onDone={() => setAside({ kind: 'roles' })} />
          ) : role ? (
            <SubagentBrief role={role} threadId={parentThreadId} onDone={out} />
          ) : aside ? (
            <SubagentRoster
              onPick={one => setAside({ kind: 'brief', roleId: one.id })}
              onNew={() => setAside({ kind: 'build', roleId: null })}
              onEdit={one => setAside({ kind: 'build', roleId: one.id })}
              onBack={out}
            />
          ) : tab.threadId ? (
            <SubagentRun threadId={tab.threadId} />
          ) : (
            <SubagentList parentThreadId={parentThreadId} onOpen={open} />
          )}
        </ScreenSwap>
      </div>
    </div>
  )
}
