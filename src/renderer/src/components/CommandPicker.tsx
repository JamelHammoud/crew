import type { CommandName, SlashCommand } from '../../../shared/commands'
import { COMMAND_MARKS } from './CommandChip'

export default function CommandPicker({
  commands,
  onPick
}: {
  commands: readonly SlashCommand[]
  onPick: (name: CommandName) => void
}) {
  return (
    <div className="p-1.5 w-72 max-h-[352px] overflow-y-auto overscroll-contain no-scrollbar">
      {commands.map(command => {
        const Mark = COMMAND_MARKS[command.name]
        return (
          <button
            key={command.name}
            onClick={() => onPick(command.name)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors text-fg/70 hover:text-fg hover:bg-fg/5"
          >
            <Mark className="w-4 h-4 shrink-0 text-fg/45" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">/{command.name}</span>
              <span className="block text-xs text-fg/45 truncate">{command.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
