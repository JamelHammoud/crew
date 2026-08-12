import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { boardFor, bestFor, SCORE_LIMIT, type GameScore } from '../src/shared/games'
import type { ServerMessage } from '../src/shared/protocol'
import { CrewSession } from '../src/server/session'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Scores = Extract<ServerMessage, { type: 'game.scores' }>

const scoresOf = (msg: ServerMessage): GameScore[] => (msg as Scores).scores

// One row per person per game, their best. A round that beat nothing is a round
// they played rather than something the crew keeps.
describe('game scores', () => {
  let host: TestHost
  let uis: TestUi[] = []

  const played = async (ui: TestUi, gameId: string, score: number): Promise<GameScore[]> => {
    ui.send({ type: 'game.score', gameId, score })
    const landed = await ui.waitFor(
      m => m.type === 'game.scores' && scoresOf(m).some(one => one.gameId === gameId && one.score === score)
    )
    return scoresOf(landed)
  }

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  it('keeps a score and tells everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const ali = await TestUi.connect(host.url, 'ali', host.code)
    uis.push(sam, ali)

    sam.send({ type: 'game.score', gameId: 'tetris', score: 1200 })
    const landed = await ali.waitFor(m => m.type === 'game.scores')
    expect(scoresOf(landed)).toEqual([expect.objectContaining({ gameId: 'tetris', name: 'sam', score: 1200 })])
  })

  it('holds one row per person per game, their best', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    await played(sam, 'tetris', 400)
    const better = await played(sam, 'tetris', 900)
    expect(better).toHaveLength(1)
    expect(better[0].score).toBe(900)

    sam.send({ type: 'game.score', gameId: 'tetris', score: 100 })
    await new Promise(r => setTimeout(r, 150))
    expect(bestFor(host.session.snapshot().gameScores ?? [], 'tetris', 'sam')).toBe(900)
  })

  it('boards each game on its own', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const ali = await TestUi.connect(host.url, 'ali', host.code)
    uis.push(sam, ali)

    await played(sam, 'tetris', 900)
    await played(ali, 'tetris', 2400)
    await played(ali, 'flappy', 7)

    const scores = host.session.snapshot().gameScores ?? []
    expect(boardFor(scores, 'tetris').map(one => one.name)).toEqual(['ali', 'sam'])
    expect(boardFor(scores, 'flappy').map(one => one.score)).toEqual([7])
  })

  it('refuses a game nobody has heard of and a score nobody could have played', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'game.score', gameId: 'pong', score: 10 })
    sam.send({ type: 'game.score', gameId: 'tetris', score: SCORE_LIMIT + 1 })
    sam.send({ type: 'game.score', gameId: 'tetris', score: -5 })
    sam.send({ type: 'game.score', gameId: 'tetris', score: Number.NaN })
    await played(sam, 'tetris', 300)

    expect(host.session.snapshot().gameScores).toEqual([
      expect.objectContaining({ gameId: 'tetris', name: 'sam', score: 300 })
    ])
  })

  // The score is the crew's own, the way the music controls are. An agent's
  // machine is connected the whole time it is joined and nothing it says lands
  // on the board.
  it('leaves the board to the crew rather than to a runner', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await played(sam, 'tetris', 500)

    const runner = new WebSocket(host.url)
    await new Promise<void>(resolve => {
      runner.on('open', () => {
        runner.send(JSON.stringify({ type: 'hello', role: 'runner', name: 'mac', code: host.code, llms: [] }))
        resolve()
      })
    })
    runner.send(JSON.stringify({ type: 'game.score', gameId: 'tetris', score: 99999 }))
    await new Promise(r => setTimeout(r, 250))
    runner.close()

    expect(host.session.snapshot().gameScores).toEqual([expect.objectContaining({ name: 'sam', score: 500 })])
  })

  // A high score lasts, so it is written down and read back. The last one in the
  // log is the one that stands, because each one already beat the one before it.
  it('is still there when the session comes back up', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await played(sam, 'tetris', 700)
    await played(sam, 'tetris', 1500)
    await played(sam, 'flappy', 4)

    const revived = new CrewSession(host.store).snapshot()
    expect(revived.gameScores).toEqual([
      expect.objectContaining({ gameId: 'tetris', name: 'sam', score: 1500 }),
      expect.objectContaining({ gameId: 'flappy', name: 'sam', score: 4 })
    ])
  })

  // The board rides in the snapshot, so it is never scrolled past in the chat.
  it('stays out of the event window', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await played(sam, 'tetris', 800)

    expect(host.session.snapshot().events.some(e => e.kind === 'game.score')).toBe(false)
  })
})
