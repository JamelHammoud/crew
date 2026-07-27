// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GameView from '../src/renderer/src/components/game/GameView'
import { useBrowser } from '../src/renderer/src/state/browser'
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

const TAB = 'tab-1'

const titleNow = (): string => useBrowser.getState().tabs[0]?.title ?? ''

const panel = (scores: GameScore[] = [], selfName = 'sam') => {
  useCrew.setState({
    scores,
    selfName,
    members: [],
    postScore: (gameId, points) => sent.push({ type: 'game.score', gameId, score: points })
  })
  return render(createElement(GameView, { tabId: TAB }))
}

beforeEach(() => {
  sent.length = 0
  useBrowser.setState({ tabs: [], activeTabId: null })
  useBrowser.getState().openGame()
  useBrowser.setState(s => ({ tabs: s.tabs.map(tab => ({ ...tab, id: TAB })), activeTabId: TAB }))
})

afterEach(cleanup)

describe('the games panel', () => {
  it('lists the games, and says what the best score on each is', () => {
    panel([score('ali', 'tetris', 2400)])

    expect(screen.getByText('Tetris')).toBeTruthy()
    expect(screen.getByText('Flappy Bird')).toBeTruthy()
    expect(screen.getByText('2,400')).toBeTruthy()
    expect(screen.getByText('ali')).toBeTruthy()
  })

  it('opens a game on its own field, and comes back out of it', () => {
    panel([score('ali', 'tetris', 2400), score('sam', 'tetris', 900)])

    fireEvent.click(screen.getByText('Tetris'))
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Back'))
    expect(screen.getByText('Flappy Bird')).toBeTruthy()
  })

  // The board is a table of people, best first, and it holds only the game it
  // is standing on. Your own row is the bright one, which is all the marking it
  // needs over artwork.
  it('boards everyone who has played that game, best first', () => {
    panel([score('ali', 'tetris', 2400), score('sam', 'tetris', 900), score('ali', 'flappy', 6)])
    fireEvent.click(screen.getByText('Tetris'))

    const rows = [...document.body.querySelectorAll('ol li')]
    expect(rows.map(row => row.textContent)).toEqual(['1Aali2,400', '2Ssam900'])
    expect(rows[1].querySelector('.text-white')).toBeTruthy()
    expect(rows[0].querySelector('.text-white')).toBeNull()
  })

  // A board of high scores beside a game being played is something to read
  // instead of the game, so it stands down the moment a game starts.
  it('takes the board away while a game is running, and says the score instead', () => {
    panel([score('ali', 'tetris', 2400)])
    fireEvent.click(screen.getByText('Tetris'))
    expect(document.body.querySelectorAll('ol li')).toHaveLength(1)


    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(document.body.querySelectorAll('ol li')).toHaveLength(0)
    expect(screen.getByText('points')).toBeTruthy()
  })

  // With nobody on it there is no board, rather than a card saying so over the
  // field somebody is about to play on.
  it('draws no board at all before anyone has played', () => {
    panel([])
    fireEvent.click(screen.getByText('Flappy Bird'))

    expect(document.body.querySelectorAll('ol')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })
})
