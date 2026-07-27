import { useCallback, useState } from 'react'
import { GAMES, boardFor, gameFor, type GameInfo } from '../../../../shared/games'
import { ChevronLeftGlyph } from '../../icons'
import { useCrew } from '../../state/store'
import ScreenSwap from '../ScreenSwap'
import Tooltip from '../Tooltip'
import FlappyGame from './FlappyGame'
import GameCover from './GameCover'
import Leaderboard from './Leaderboard'
import TetrisGame from './TetrisGame'

const COVER = { width: 92, height: 58 }

function GameRow({ game, onOpen }: { game: GameInfo; onOpen: (gameId: string) => void }) {
  const scores = useCrew(s => s.scores)
  const top = boardFor(scores, game.id)[0]

  return (
    <button
      onClick={() => onOpen(game.id)}
      className="w-full p-2 rounded-card flex items-center gap-3 text-left transition-colors duration-150 hover:bg-fg/[0.05] active:scale-[0.99]"
    >
      <GameCover gameId={game.id} width={COVER.width} height={COVER.height} className="rounded-field" />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-semibold text-fg">{game.name}</span>
        <span className="block truncate text-xs text-fg-muted">{game.note}</span>
      </span>
      {top && (
        <span className="shrink-0 pr-1 text-right">
          <span className="block text-sm font-medium text-fg tabular-nums">
            {top.score.toLocaleString()}
          </span>
          <span className="block truncate max-w-24 text-xs text-fg-faint">{top.name}</span>
        </span>
      )}
    </button>
  )
}

function GamePlay({ game }: { game: GameInfo }) {
  const postScore = useCrew(s => s.postScore)
  const onScore = useCallback((score: number) => postScore(game.id, score), [game.id, postScore])
  const board = <Leaderboard game={game} />

  return (
    <div className="absolute inset-0 flex flex-col px-4 pt-2 pb-4">
      {game.id === 'tetris' ? (
        <TetrisGame onScore={onScore}>{board}</TetrisGame>
      ) : (
        <FlappyGame onScore={onScore}>{board}</FlappyGame>
      )}
    </div>
  )
}

export default function GameView() {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? gameFor(openId) : null

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3 pb-1 flex items-center">
        <ScreenSwap screen={open ? 'one' : 'all'} depth={open ? 1 : 0}>
          {open ? (
            <div className="flex items-center gap-1">
              <Tooltip label="Back">
                <button
                  onClick={() => setOpenId(null)}
                  aria-label="Back"
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <ChevronLeftGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
              <h3 className="text-sm font-semibold text-fg">{open.name}</h3>
            </div>
          ) : (
            <h3 className="h-8 pl-1 flex items-center text-sm font-semibold text-fg">Game</h3>
          )}
        </ScreenSwap>
      </div>

      <div className="relative flex-1 min-h-0">
        <ScreenSwap screen={open ? `game:${open.id}` : 'all'} depth={open ? 1 : 0} fill>
          {open ? (
            <GamePlay game={open} />
          ) : (
            <div className="absolute inset-0 overflow-y-auto [scrollbar-width:thin] px-2 pb-4">
              {GAMES.map(one => (
                <GameRow key={one.id} game={one} onOpen={setOpenId} />
              ))}
            </div>
          )}
        </ScreenSwap>
      </div>
    </div>
  )
}
