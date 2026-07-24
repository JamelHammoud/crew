import { expect, test } from 'vitest'
import { tokenizeMentions } from '../src/renderer/src/components/mentionTokens'
import type { PooledAgent } from '../src/shared/llm'

const agents = [{ id: 'a1', label: 'Bob (Kimi K3)' }] as PooledAgent[]
const docs = {
  main: { title: 'Ideas', text: '' },
  'everything-ive-added-1ydl': { title: "Everything I've added", text: '' },
  'this-is-a-parent-page': { title: 'This is a parent page', text: '' },
  'this-is-a-parent-page/this-is-a-child-page': { title: 'This is a child page', text: 'Whohoo!!' }
}

test('fallback pills the exact persisted text', () => {
  const text = '@Bob (Kimi K3)  #This is a child page  what does this page say?'
  const tokens = tokenizeMentions(text, agents, docs, undefined)
  console.log(JSON.stringify(tokens, null, 2))
  expect(tokens.some(t => t.kind === 'doc')).toBe(true)
})
