import { pressDoes, type UpdateStage } from '../../../shared/update'
import { pressUpdate, useUpdate } from '../state/update'
import Tooltip from './Tooltip'

const WORDS: Record<UpdateStage, string> = {
  none: '',
  found: 'Update available',
  getting: 'Updating',
  ready: 'Restart to update',
  failed: 'Update available'
}

export default function UpdatePill() {
  const update = useUpdate()
  if (update.stage === 'none') return null
  const waiting = pressDoes(update.stage) === 'none'

  return (
    <Tooltip label={`Crew ${update.version}`}>
      <button
        onClick={() => pressUpdate()}
        disabled={waiting}
        className={`relative flex h-8 items-center overflow-hidden rounded-full px-3 text-xs font-medium text-fg transition-all duration-150 ${
          waiting ? 'bg-fg/[0.06]' : 'bg-fg/[0.06] hover:bg-fg/[0.1] active:scale-95'
        }`}
      >
        {/* How far the new Crew has come, said by the pill filling rather than
            by a number beside the word saying the same thing again. */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-fg/[0.14] transition-[width] duration-300 ease-out"
          style={{ width: `${update.percent}%` }}
        />
        <span className="relative">{WORDS[update.stage]}</span>
      </button>
    </Tooltip>
  )
}
