import { boardFor, type GameInfo } from '../../../../shared/games'
import { useCrew } from '../../state/store'
import Avatar from '../Avatar'

const SHOWN = 5

// The board for one game: everyone's best, best first. It is a table of people
// rather than a log of rounds, so a name appears once however long the crew has
// been playing.
//
// It stands on the overlay over the field, which is artwork and is the same deep
// blue in either theme, so it is set in white at an opacity rather than in the
// foreground the rest of the app uses. Your own row is the bright one, which is
// all the marking it needs.
export default function Leaderboard({ game }: { game: GameInfo }) {
  const scores = useCrew(s => s.scores)
  const selfName = useCrew(s => s.selfName)
  const board = boardFor(scores, game.id)

  if (board.length === 0) return null

  return (
    <ol className="w-full max-w-60 flex flex-col">
      {board.slice(0, SHOWN).map((one, index) => {
        const mine = one.name === selfName
        return (
          <li key={one.name} className="h-8 flex items-center gap-2.5">
            <span className="w-3 shrink-0 text-xs text-white/35 tabular-nums">{index + 1}</span>
            <Avatar name={one.name} size="xs" />
            <span className={`flex-1 min-w-0 truncate text-xs ${mine ? 'text-white' : 'text-white/60'}`}>
              {one.name}
            </span>
            <span className={`shrink-0 text-xs font-semibold tabular-nums ${mine ? 'text-white' : 'text-white/60'}`}>
              {one.score.toLocaleString()}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
