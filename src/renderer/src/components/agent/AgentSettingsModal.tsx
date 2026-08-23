import type { AgentSettingField, AgentSettings } from '../../../../shared/llm'
import { advancedFields, changedSettings } from '../../../../shared/llm'
import Modal from '../Modal'
import { SettingSections } from './SettingRows'

export default function AgentSettingsModal({
  open,
  label,
  fields,
  settings,
  onChange,
  onClose
}: {
  open: boolean
  label: string
  fields: AgentSettingField[]
  settings: AgentSettings
  onChange: (key: string, value: string) => void
  onClose: () => void
}) {
  const deeper = advancedFields(fields)
  const changed = changedSettings(deeper, settings).length

  const putBack = () => {
    for (const field of deeper) {
      if ((settings[field.key] ?? field.default) !== field.default) onChange(field.key, field.default)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Advanced"
      width={460}
      flush
      className="max-h-[calc(100dvh-3rem)] flex flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 space-y-5">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-fg">{label}</h3>
          {changed > 0 && (
            <button
              onClick={putBack}
              className="ml-auto text-sm font-semibold text-fg/45 transition-colors hover:text-fg active:scale-95"
            >
              Reset
            </button>
          )}
        </div>
        <div>
          <SettingSections fields={deeper} settings={settings} onChange={onChange} />
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={onClose}
            className="h-10 px-5 rounded-full bg-fg text-ink-900 text-sm font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
