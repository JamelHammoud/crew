import { boardFor, type GameInfo } from '../../../../shared/games'
import { useCrew } from '../../state/store'
import Avatar from '../Avatar'
import Pill from '../Pill'

// The board for one game: everyone's best, best first. It is a table of people
// rather than a log of rounds, so a name appears once however long the crew has
// been playing.
export default function Leaderboard({ game }: { game: GameInfo }) {
  const scores = useCrew(s => s.scores)
  const selfName = useCrew(s => s.selfName)
  const board = boardFor(scores, game.id)

  return (
    <section className="shrink-0">
      <h4 className="px-1 pb-2 text-xs font-medium text-fg-muted">High scores</h4>
      {board.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-fg-faint">Nobody has played yet</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {board.map((one, index) => (
            <li
              key={one.name}
              className={`h-11 px-2.5 rounded-field flex items-center gap-2.5 ${
                one.name === selfName ? 'bg-fg/[0.06]' : ''
              }`}
            >
              <span className="w-4 shrink-0 text-xs font-semibold text-fg-muted tabular-nums">{index + 1}</span>
              <Avatar name={one.name} size="sm" />
              <span className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="truncate text-sm text-fg">{one.name}</span>
                {one.name === selfName && <Pill>You</Pill>}
              </span>
              <span className="shrink-0 text-sm font-semibold text-fg tabular-nums">
                {one.score.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
