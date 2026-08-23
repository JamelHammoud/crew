import { useEffect, useState } from 'react'
import { claudeLoginCommand } from '../../../../shared/claude'
import type { PooledAgent } from '../../../../shared/llm'
import { advancedFields, changedSettings, plainFields, visibleSettingFields } from '../../../../shared/llm'
import { ChevronLeftGlyph } from '../../icons'
import AgentIcon from '../AgentIcon'
import Modal from '../Modal'
import PhotoPicker from '../PhotoPicker'
import ScreenSwap from '../ScreenSwap'
import TextField from '../TextField'
import OpenRow from './OpenRow'
import SettingRows, { SettingSections } from './SettingRows'
import { useBrowser } from '../../state/browser'

type Screen = 'agent' | 'advanced'

const TITLES: Record<Screen, string> = { agent: 'Agent settings', advanced: 'Advanced' }

const DEPTH: Record<Screen, number> = { agent: 0, advanced: 1 }

export default function AgentSettingsModal({
  open,
  agent,
  onChange,
  onRename,
  onAvatar,
  onClose
}: {
  open: boolean
  agent: PooledAgent
  onChange: (key: string, value: string) => void
  onRename?: (label: string) => void
  onAvatar?: (file: File | null) => void
  onClose: () => void
}) {
  const [screen, setScreen] = useState<Screen>('agent')
  const [draft, setDraft] = useState<string | null>(null)
  const plain = plainFields(agent.fields)
  const deeper = advancedFields(agent.fields)
  const deeperShown = visibleSettingFields(deeper, agent.settings)
  const changed = changedSettings(deeper, agent.settings).length

  useEffect(() => {
    if (open) setScreen('agent')
  }, [open])

  const commit = () => {
    const label = (draft ?? '').trim()
    if (label && label !== agent.label) onRename?.(label)
    setDraft(null)
  }

  const close = () => {
    commit()
    onClose()
  }

  const settingAction = (value: string) => {
    close()
    useBrowser.getState().addTerminal(claudeLoginCommand(value))
  }

  const putBack = () => {
    for (const field of deeper) {
      if ((agent.settings[field.key] ?? field.default) !== field.default) onChange(field.key, field.default)
    }
  }

  const face = <AgentIcon seed={agent.id} size="lg" presence={agent.status === 'offline' ? 'offline' : 'online'} />

  return (
    <Modal
      open={open}
      onClose={close}
      title={TITLES[screen]}
      width={460}
      flush
      header={
        screen === 'agent' ? (
          <div className="shrink-0 px-6 pt-6 flex items-center gap-3.5">
            {onAvatar ? (
              <PhotoPicker has={Boolean(agent.avatar)} onChange={onAvatar}>
                {face}
              </PhotoPicker>
            ) : (
              face
            )}
            <TextField
              glass
              value={draft ?? agent.label}
              onChange={event => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={event => {
                if (event.key === 'Enter') commit()
              }}
              placeholder="Agent name"
              aria-label="Agent name"
              disabled={!onRename}
              className="h-10 text-base"
            />
          </div>
        ) : (
          <div className="shrink-0 px-6 pt-6 flex items-center gap-2">
            <button
              onClick={() => setScreen('agent')}
              aria-label="Back"
              className="w-9 h-9 shrink-0 rounded-full bg-fg/[0.07] flex items-center justify-center text-fg/70 transition-all duration-150 hover:bg-fg/[0.12] hover:text-fg active:scale-95"
            >
              <ChevronLeftGlyph className="w-[18px] h-[18px]" />
            </button>
            <h3 className="text-base font-semibold text-fg">{agent.label}</h3>
            {changed > 0 && (
              <button
                onClick={putBack}
                className="ml-auto text-sm font-semibold text-fg/45 transition-colors hover:text-fg active:scale-95"
              >
                Reset
              </button>
            )}
          </div>
        )
      }
      footer={
        <div className="shrink-0 px-6 pb-6 pt-5 flex items-center justify-end">
          <button
            onClick={screen === 'agent' ? close : () => setScreen('agent')}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95"
          >
            Done
          </button>
        </div>
      }
    >
      <ScreenSwap screen={screen} depth={DEPTH[screen]}>
        {screen === 'agent' ? (
          <div className="px-6 pt-5">
            <SettingRows
              fields={plain}
              settings={agent.settings}
              onChange={onChange}
              onAction={(_, value) => settingAction(value)}
            />
            {deeperShown.length > 0 && (
              <OpenRow
                label="Advanced"
                hint={changed > 0 ? `${changed} changed` : undefined}
                onOpen={() => setScreen('advanced')}
              />
            )}
          </div>
        ) : (
          <div className="px-6 pt-5">
            <SettingSections
              fields={deeper}
              settings={agent.settings}
              onChange={onChange}
              onAction={(_, value) => settingAction(value)}
            />
          </div>
        )}
      </ScreenSwap>
    </Modal>
  )
}
