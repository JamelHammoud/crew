// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GameView from '../src/renderer/src/components/game/GameView'
import { useCrew } from '../src/renderer/src/state/store'
import type { GameScore } from '../src/shared/games'
import type { ClientMessage } from '../src/shared/protocol'

Element.prototype.getAnimations ??= () => []
// jsdom draws nothing, and the covers ask for a context they will not get. The
// drawing already stands down when there is none, so this only keeps the run
// from printing a page of the same warning.
HTMLCanvasElement.prototype.getContext = (() => null) as never
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never

const sent: ClientMessage[] = []

const score = (name: string, gameId: string, points: number, ts = 1): GameScore => ({
  gameId,
  name,
  score: points,
  ts
})

const panel = (scores: GameScore[] = [], selfName = 'sam') => {
  useCrew.setState({
    scores,
    selfName,
    members: [],
    postScore: (gameId, points) => sent.push({ type: 'game.score', gameId, score: points })
  })
  return render(createElement(GameView, {}))
}

beforeEach(() => {
  sent.length = 0
})

afterEach(cleanup)

describe('the games panel', () => {
  it('lists the games, and says what the best score on each is', () => {
    panel([score('ali', 'tetris', 2400)])

    expect(screen.getByText('Tetris')).toBeTruthy()
    expect(screen.getByText('Flappy Bird')).toBeTruthy()
    expect(screen.getByText('2,400 by ali')).toBeTruthy()
    expect(screen.getByText('No scores yet')).toBeTruthy()
  })

  it('opens a game on its own field, and comes back out of it', () => {
    panel([score('ali', 'tetris', 2400), score('sam', 'tetris', 900)])

    fireEvent.click(screen.getByText('Tetris'))
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Back'))
    expect(screen.getByText('Flappy Bird')).toBeTruthy()
  })

  // The board is a table of people, best first, with your own row marked.
  it('boards everyone who has played, best first', () => {
    panel([score('ali', 'tetris', 2400), score('sam', 'tetris', 900), score('ali', 'flappy', 6)])
    fireEvent.click(screen.getByText('Tetris'))

    const names = [...document.body.querySelectorAll('ol li')].map(row => row.textContent)
    expect(names).toHaveLength(2)
    expect(names[0]).toContain('ali')
    expect(names[1]).toContain('sam')
    expect(names[1]).toContain('You')
  })

  // A board of high scores beside a game being played is something to read
  // instead of the game, so it stands down the moment a game starts.
  it('takes the board away while a game is running', () => {
    panel([score('ali', 'tetris', 2400)])
    fireEvent.click(screen.getByText('Tetris'))
    expect(document.body.querySelectorAll('ol li')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(document.body.querySelectorAll('ol li')).toHaveLength(0)
  })

  it('starts on nobody having played', () => {
    panel([])
    fireEvent.click(screen.getByText('Flappy Bird'))

    expect(screen.getByText('Nobody has played yet')).toBeTruthy()
  })
})
