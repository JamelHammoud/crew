import { pressDoes, updateStanding, type UpdateStage } from '../../../shared/update'
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
  if (!updateStanding(update)) return null
  const waiting = pressDoes(update.stage) === 'none'
  const word = WORDS[update.stage]

  return (
    <Tooltip label={`Crew ${update.version}`}>
      <button
        onClick={() => pressUpdate()}
        disabled={waiting}
        className={`relative h-8 overflow-hidden rounded-full text-xs font-semibold transition-colors duration-150 ${
          waiting ? 'bg-fg/[0.14] text-fg' : 'bg-fg text-ink-900 hover:bg-fg/90 active:scale-95'
        }`}
      >
        <span className="flex h-full items-center whitespace-nowrap px-3">{word}</span>
        {/* How far the new Crew has come, said by the pill filling rather than
            by a number beside the word saying the same thing again. The word is
            written twice, once on each side of the fill, so it stays legible
            over the white as it passes under it. */}
        {waiting && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 overflow-hidden bg-fg text-ink-900 transition-[width] duration-300 ease-out"
            style={{ width: `${update.percent}%` }}
          >
            <span className="flex h-full items-center whitespace-nowrap px-3">{word}</span>
          </span>
        )}
      </button>
    </Tooltip>
  )
}
