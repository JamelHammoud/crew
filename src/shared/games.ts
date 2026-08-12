// Something to play while you wait. The games are the app's own, they run in the
// side panel, and the only thing about them the crew keeps is the score: one row
// per person per game, their best, so a leaderboard is a table of people rather
// than a log of every round anyone ever played.

export interface GameInfo {
  id: string
  name: string
  // One line for what it is, which is all a row has space for.
  note: string
  // What the score counts, in one word, so a column can say lines or pipes
  // rather than points for everything.
  unit: string
}

// The id is what a score is filed under, so it outlives whatever the game is
// called: a name can be changed without anyone's best round going with it.
export const GAMES: readonly GameInfo[] = [
  { id: 'tetris', name: 'Falling Blocks', note: 'Clear a line without a gap in it', unit: 'points' },
  { id: 'flappy', name: 'Birdie', note: 'Fly through the gaps', unit: 'pipes' }
]

export const gameFor = (gameId: string): GameInfo | null => GAMES.find(game => game.id === gameId) ?? null

export interface GameScore {
  gameId: string
  name: string
  score: number
  ts: number
}

// A round nobody could really have played is not a score. The ceiling is high
// enough that nothing anyone reaches by hand is refused and low enough that a
// number arriving from somewhere else cannot sit at the top of the board
// forever.
export const SCORE_LIMIT = 1_000_000

export function cleanGameScore(gameId: string, score: unknown): number | null {
  if (!gameFor(gameId)) return null
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  const whole = Math.floor(score)
  if (whole <= 0 || whole > SCORE_LIMIT) return null
  return whole
}

const key = (gameId: string, name: string): string => `${gameId}\n${name.toLowerCase()}`

// The board for one game, best first. Two people on the same score are read in
// the order they got there, so whoever did it first stands higher.
export function boardFor(scores: GameScore[], gameId: string): GameScore[] {
  return scores.filter(one => one.gameId === gameId).sort((a, b) => b.score - a.score || a.ts - b.ts)
}

export function bestFor(scores: GameScore[], gameId: string, name: string): number {
  const held = new Map(scores.map(one => [key(one.gameId, one.name), one]))
  return held.get(key(gameId, name))?.score ?? 0
}

// A score is only news if it beats the one that person already has. Everything
// else is a round they played, and a round is not something the crew keeps.
export function beats(scores: GameScore[], gameId: string, name: string, score: number): boolean {
  return score > bestFor(scores, gameId, name)
}
