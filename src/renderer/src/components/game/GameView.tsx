import { useCallback, useState } from 'react'
import { GAMES, boardFor, gameFor, type GameInfo } from '../../../../shared/games'
import { ChevronLeftGlyph } from '../../icons'
import { useBrowser } from '../../state/browser'
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
          <span className="block text-sm font-medium text-fg tabular-nums">{top.score.toLocaleString()}</span>
          <span className="block truncate max-w-24 text-xs text-fg-faint">{top.name}</span>
        </span>
      )}
    </button>
  )
}

function GamePlay({ game, onLive }: { game: GameInfo; onLive: (score: number | null) => void }) {
  const postScore = useCrew(s => s.postScore)
  const onScore = useCallback((score: number) => postScore(game.id, score), [game.id, postScore])
  const board = <Leaderboard game={game} />

  return (
    <div className="absolute inset-0 flex flex-col px-4 pt-3 pb-4">
      {game.id === 'tetris' ? (
        <TetrisGame onScore={onScore} onLive={onLive}>
          {board}
        </TetrisGame>
      ) : (
        <FlappyGame onScore={onScore} onLive={onLive}>
          {board}
        </FlappyGame>
      )}
    </div>
  )
}

// Which game is open rides on the tab rather than in here, so the tab up the
// panel is named after it the way a web tab is named after its page, and a look
// at another tab leaves you where you were rather than back at the top of the
// list.
export default function GameView({ tabId }: { tabId: string }) {
  const openId = useBrowser(s => s.tabs.find(tab => tab.id === tabId)?.game ?? null)
  const [live, setLive] = useState<number | null>(null)
  const open = openId ? gameFor(openId) : null

  const go = (gameId: string | null) => {
    setLive(null)
    useBrowser.getState().updateTab(tabId, { game: gameId })
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 h-11 px-4 pt-3 pb-1 flex items-center gap-2">
        <ScreenSwap screen={open ? 'one' : 'all'} depth={open ? 1 : 0}>
          {open ? (
            <div className="flex items-center gap-1">
              <Tooltip label="Back">
                <button
                  onClick={() => go(null)}
                  aria-label="Back"
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95"
                >
                  <ChevronLeftGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
              <h3 className="text-sm font-semibold text-fg">{open.name}</h3>
            </div>
          ) : (
            <h3 className="h-8 pl-1 flex items-center text-sm font-semibold text-fg">Games</h3>
          )}
        </ScreenSwap>
        {/* What you have this round, on the one line the panel already has,
            rather than on a row of its own over the field. */}
        {open && live !== null && (
          <span className="ml-auto flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-fg tabular-nums">{live.toLocaleString()}</span>
            <span className="text-xs text-fg-muted">{open.unit}</span>
          </span>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <ScreenSwap screen={open ? `game:${open.id}` : 'all'} depth={open ? 1 : 0} fill>
          {open ? (
            <GamePlay game={open} onLive={setLive} />
          ) : (
            <div className="absolute inset-0 overflow-y-auto [scrollbar-width:thin] px-2 pb-4">
              {GAMES.map(one => (
                <GameRow key={one.id} game={one} onOpen={go} />
              ))}
            </div>
          )}
        </ScreenSwap>
      </div>
    </div>
  )
}
