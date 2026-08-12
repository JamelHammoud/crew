import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Store } from '../src/server/store'
import type { SessionEvent } from '../src/shared/events'
import { tmpDir } from './helpers/session'

const message = (id: string, ts: number, text: string): SessionEvent => ({
  id,
  ts,
  kind: 'message',
  authorId: 'u1',
  authorName: 'sam',
  text,
  mentions: []
})

const segments = (root: string): string[] => {
  const dir = path.join(root, '.crew', 'chat')
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
}

describe('the chat log', () => {
  it('writes new events to a segment, leaving the legacy file alone', () => {
    const repo = tmpDir('chatlog')
    const store = new Store(repo)
    const legacy = path.join(repo, '.crew', 'chat.jsonl')
    fs.writeFileSync(legacy, JSON.stringify(message('old', 1, 'from before')) + '\n')
    const before = fs.readFileSync(legacy, 'utf8')

    store.appendEvent(message('new', 2, 'after the change'))

    expect(fs.readFileSync(legacy, 'utf8')).toBe(before)
    expect(segments(repo)).toEqual(['0001.jsonl'])
    expect(store.loadEvents().map(e => e.id)).toEqual(['old', 'new'])
  })

  it('reads a log that has only ever been the legacy file', () => {
    const repo = tmpDir('chatlog')
    const store = new Store(repo)
    fs.writeFileSync(
      path.join(repo, '.crew', 'chat.jsonl'),
      [message('a', 1, 'one'), message('b', 2, 'two')].map(e => JSON.stringify(e)).join('\n') + '\n'
    )
    expect(store.loadEvents().map(e => e.id)).toEqual(['a', 'b'])
  })

  it('seals a segment rather than letting one file grow without end', () => {
    const repo = tmpDir('chatlog')
    const store = new Store(repo)
    const text = 'x'.repeat(20_000)
    for (let index = 0; index < 120; index++) store.appendEvent(message(`e${index}`, index, text))

    const written = segments(repo)
    expect(written.length).toBeGreaterThan(1)
    for (const file of written) {
      const size = fs.statSync(path.join(repo, '.crew', 'chat', file)).size
      expect(size).toBeLessThan(1_100_000)
    }
    expect(store.loadEvents()).toHaveLength(120)
  })

  it('gives events back in order across the legacy file and every segment', () => {
    const repo = tmpDir('chatlog')
    const store = new Store(repo)
    fs.writeFileSync(path.join(repo, '.crew', 'chat.jsonl'), JSON.stringify(message('first', 1, 'oldest')) + '\n')
    store.appendEvent(message('third', 30, 'newest'))
    fs.writeFileSync(
      path.join(repo, '.crew', 'chat', '0002.jsonl'),
      JSON.stringify(message('second', 20, 'middle')) + '\n'
    )

    expect(store.loadEvents().map(e => e.id)).toEqual(['first', 'second', 'third'])
  })

  it('drops the duplicate lines a union merge can leave behind', () => {
    const repo = tmpDir('chatlog')
    const store = new Store(repo)
    const line = JSON.stringify(message('once', 5, 'said one time')) + '\n'
    fs.mkdirSync(path.join(repo, '.crew', 'chat'), { recursive: true })
    fs.writeFileSync(path.join(repo, '.crew', 'chat', '0001.jsonl'), line + line)

    expect(store.loadEvents().map(e => e.id)).toEqual(['once'])
  })
})
