import { relabelMentions } from '../../../shared/llm'
import { BranchGlyph } from '../icons'
import { useCrew } from '../state/store'

export default function ForkedFrom({ threadId }: { threadId: string }) {
  const thread = useCrew(s => s.threads[threadId])
  const agents = useCrew(s => s.agents)
  const openThread = useCrew(s => s.openThread)
  if (!thread) return null

  return (
    <button
      onClick={() => openThread(threadId)}
      className="w-full flex items-center gap-2 text-xs text-fg-muted transition-colors cursor-pointer hover:text-fg"
    >
      <BranchGlyph className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">Carried on from {relabelMentions(thread.title, thread.titleRefs, agents)}</span>
    </button>
  )
}
