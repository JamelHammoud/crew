import { useState } from 'react'
import type { PooledAgent } from '../../../shared/llm'
import { PencilGlyph, StopGlyph, TrashGlyph } from '../icons'
import AgentIcon from './AgentIcon'
import AgentSettingsModal from './agent/AgentSettingsModal'
import PhotoPicker from './PhotoPicker'
import ProviderMark from './ProviderMark'
import Spinner from './Spinner'
import Tooltip from './Tooltip'
import UsageFooter from './UsageFooter'

export default function AgentCard({
  agent,
  threadCount,
  onStop,
  onSetting,
  onRename,
  onAvatar,
  onRemove
}: {
  agent: PooledAgent
  threadCount: number
  onStop?: () => void
  onSetting?: (key: string, value: string) => void
  onRename?: (label: string) => void
  onAvatar?: (file: File | null) => void
  onRemove?: () => void
}) {
  const status = threadCount > 0 ? 'busy' : agent.status
  const [editing, setEditing] = useState(false)

  const face = <AgentIcon seed={agent.id} presence={agent.status === 'offline' ? 'offline' : 'online'} />

  return (
    <div className="group border border-fg/[0.09] rounded-card flex flex-col transition-colors duration-200 hover:border-fg/20 animate-rise">
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center gap-3">
          {onAvatar ? (
            <PhotoPicker has={Boolean(agent.avatar)} onChange={onAvatar}>
              {face}
            </PhotoPicker>
          ) : (
            face
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-fg truncate">{agent.label}</span>
              <ProviderMark provider={agent.provider} />
            </div>
            <span className="text-sm text-fg/45">{agent.ownerName}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {onSetting && (
              <Tooltip label="Settings" disabled={editing}>
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Agent settings"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-fg/45 hover:text-fg hover:bg-fg/[0.08] transition-colors"
                >
                  <PencilGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            {threadCount > 0 && onStop && (
              <Tooltip label={threadCount > 1 ? 'Stop all threads' : 'Stop'}>
                <button
                  onClick={onStop}
                  aria-label="Stop"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-fg/45 hover:text-fg hover:bg-fg/[0.08] transition-colors"
                >
                  <StopGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            {onRemove && threadCount === 0 && (
              <Tooltip label="Remove agent">
                <button
                  onClick={onRemove}
                  aria-label="Remove agent"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-fg/45 hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <TrashGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      {onSetting && (
        <AgentSettingsModal
          open={editing}
          agent={agent}
          onChange={onSetting}
          onRename={onRename}
          onAvatar={onAvatar}
          onClose={() => setEditing(false)}
        />
      )}
      {agent.usage && <UsageFooter usage={agent.usage} />}
      {status === 'busy' && (
        <div className="bg-fg/[0.07] px-5 h-11 flex items-center gap-2.5 rounded-b-[19px]">
          <Spinner size={14} className="text-fg" />
          <span className="text-sm font-semibold text-fg">Working</span>
          {threadCount > 1 && <span className="text-sm text-fg/45">on {threadCount} threads</span>}
        </div>
      )}
    </div>
  )
}
