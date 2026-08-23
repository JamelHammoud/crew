import { updateStanding } from '../../../shared/update'
import { pressUpdate, useUpdate } from '../state/update'
import Tooltip from './Tooltip'

export default function UpdatePill() {
  const update = useUpdate()
  if (!updateStanding(update)) return null

  return (
    <Tooltip label={`Crew ${update.version}`}>
      <button
        onClick={() => pressUpdate()}
        className="relative h-8 overflow-hidden rounded-full bg-fg px-3 text-xs font-semibold text-ink-900 transition-colors duration-150 hover:bg-fg/90 active:scale-95"
      >
        Restart to update
      </button>
    </Tooltip>
  )
}
