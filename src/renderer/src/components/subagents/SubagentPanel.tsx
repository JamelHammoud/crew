import { ChevronLeftGlyph } from '../../icons'
import { useBrowser, type BrowserTab } from '../../state/browser'
import { useCrew } from '../../state/store'
import ScreenSwap from '../ScreenSwap'
import Tooltip from '../Tooltip'
import SubagentList from './SubagentList'
import SubagentRun from './SubagentRun'

// Two screens in one tab, carried by ScreenSwap the way the music panel carries
// a list. Nothing here is built or picked: a helper exists because an agent
// made one up mid-run, so the whole of this is reading them.

const roundButton =
  'rounded-full flex items-center justify-center text-fg-secondary transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95 bg-ink-800'

export default function SubagentPanel({ tab }: { tab: BrowserTab }) {
  const updateTab = useBrowser(state => state.updateTab)
  const child = useCrew(state => (tab.threadId ? state.threads[tab.threadId] : undefined))

  // Where the list is: the tab's own parent, or the parent of whatever it was
  // opened on. A chip hands over the helper alone, so the way back out of one
  // is worked out here rather than being carried around.
  const parentThreadId = tab.parentThreadId || child?.parentThreadId || ''
  const inside = Boolean(tab.threadId)

  const open = (threadId: string) => updateTab(tab.id, { threadId, parentThreadId })
  const out = () => updateTab(tab.id, { threadId: '', parentThreadId })

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center gap-2">
        <ScreenSwap screen={inside ? 'back' : 'top'} depth={inside ? 1 : 0}>
          {inside ? (
            <Tooltip label="All helpers">
              <button onClick={out} aria-label="All helpers" className={`${roundButton} w-8 h-8`}>
                <ChevronLeftGlyph className="w-4 h-4" />
              </button>
            </Tooltip>
          ) : (
            <span className="text-sm font-semibold text-fg pl-1">Helpers</span>
          )}
        </ScreenSwap>
      </div>

      <div className="relative flex-1 min-h-0">
        <ScreenSwap screen={inside ? `run:${tab.threadId}` : 'list'} depth={inside ? 1 : 0} fill>
          {inside ? (
            <SubagentRun threadId={tab.threadId} />
          ) : (
            <SubagentList parentThreadId={parentThreadId} onOpen={open} />
          )}
        </ScreenSwap>
      </div>
    </div>
  )
}
