import { boardFor, type GameInfo } from '../../../../shared/games'
import { useCrew } from '../../state/store'
import Avatar from '../Avatar'
import Pill from '../Pill'

const SHOWN = 5

// The board for one game: everyone's best, best first. It is a table of people
// rather than a log of rounds, so a name appears once however long the crew has
// been playing, and it only stands under the field while nobody is playing.
export default function Leaderboard({ game }: { game: GameInfo }) {
  const scores = useCrew(s => s.scores)
  const selfName = useCrew(s => s.selfName)
  const board = boardFor(scores, game.id)

  if (board.length === 0) {
    return <p className="shrink-0 py-3 text-center text-xs text-fg-faint">Nobody has played yet</p>
  }

  return (
    <ol className="shrink-0 flex flex-col">
      {board.slice(0, SHOWN).map((one, index) => (
        <li key={one.name} className="h-9 flex items-center gap-2.5">
          <span className="w-3 shrink-0 text-xs text-fg-faint tabular-nums">{index + 1}</span>
          <Avatar name={one.name} size="xs" />
          <span className="flex-1 min-w-0 flex items-center gap-1.5">
            <span className="truncate text-sm text-fg-secondary">{one.name}</span>
            {one.name === selfName && <Pill>You</Pill>}
          </span>
          <span className="shrink-0 text-sm font-medium text-fg tabular-nums">
            {one.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  )
}
